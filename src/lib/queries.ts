import { read } from "./neo4j";
import type { Source, Visibility } from "./contract";

export type BookmarkSummary = {
  xPostId: string;
  url: string;
  text: string;
  authorHandle: string;
  createdAt: string;
  folder: string | null;
  source: Source;
  visibility: Visibility;
  topics: string[];
};

export type BookmarkDetail = BookmarkSummary & {
  conversationId: string | null;
  publicMetrics: Record<string, unknown> | null;
  ingestedAt: string | null;
  updatedAt: string | null;
};

export type Facet = { value: string; count: number };

export type ExploreFilters = {
  q?: string;
  folder?: string;
  source?: string;
  topic?: string;
  author?: string;
  visibility?: string;
  limit?: number;
};

/**
 * Lucene reserved characters would otherwise turn a stray `?` or `:` in the search box
 * into a parser error from the full-text index.
 */
function escapeLucene(input: string): string {
  return input.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
}

/** Last term gets a `*` so search feels incremental while typing. */
function toFullTextQuery(q: string): string {
  const terms = q.trim().split(/\s+/).filter(Boolean).map(escapeLucene);
  if (terms.length === 0) return "";
  const last = terms.pop() as string;
  return [...terms, `${last}*`].join(" AND ");
}

const SUMMARY_PROJECTION = `
  b.xPostId AS xPostId,
  b.url AS url,
  b.text AS text,
  b.authorHandle AS authorHandle,
  toString(b.createdAt) AS createdAt,
  b.folder AS folder,
  b.source AS source,
  b.visibility AS visibility,
  topics
`;

const FILTER_PREDICATE = `
  ($folder IS NULL OR b.folder = $folder)
  AND ($source IS NULL OR b.source = $source)
  AND ($visibility IS NULL OR b.visibility = $visibility)
  AND ($author IS NULL OR b.authorHandle = $author)
  AND ($topic IS NULL OR EXISTS { (b)-[:ABOUT]->(:Topic {name: $topic}) })
`;

const LIST_BY_RECENCY = `
MATCH (b:Bookmark)
WHERE ${FILTER_PREDICATE}
OPTIONAL MATCH (b)-[:ABOUT]->(t:Topic)
WITH b, collect(DISTINCT t.name) AS topics
RETURN ${SUMMARY_PROJECTION}
ORDER BY b.createdAt DESC, b.xPostId DESC
LIMIT toInteger($limit)
`;

const LIST_BY_SEARCH = `
CALL db.index.fulltext.queryNodes('bookmark_text', $ftq) YIELD node AS b, score
WHERE ${FILTER_PREDICATE}
OPTIONAL MATCH (b)-[:ABOUT]->(t:Topic)
WITH b, score, collect(DISTINCT t.name) AS topics
RETURN ${SUMMARY_PROJECTION}
ORDER BY score DESC, b.createdAt DESC
LIMIT toInteger($limit)
`;

/**
 * `disableLosslessIntegers` makes the driver send JS numbers as Cypher floats, which
 * `LIMIT` rejects — hence `LIMIT toInteger($limit)` in every query below.
 */
function filterParams(filters: ExploreFilters) {
  return {
    folder: filters.folder ?? null,
    source: filters.source ?? null,
    visibility: filters.visibility ?? null,
    author: filters.author ?? null,
    topic: filters.topic ?? null,
    limit: Math.min(Math.max(filters.limit ?? 50, 1), 200),
  };
}

export async function listBookmarks(filters: ExploreFilters = {}): Promise<BookmarkSummary[]> {
  const params = filterParams(filters);
  const ftq = filters.q ? toFullTextQuery(filters.q) : "";

  const result = ftq
    ? await read<BookmarkSummary>(LIST_BY_SEARCH, { ...params, ftq })
    : await read<BookmarkSummary>(LIST_BY_RECENCY, params);

  return result.records.map((record) => record.toObject());
}

export async function countBookmarks(): Promise<{
  bookmarks: number;
  authors: number;
  topics: number;
  curated: number;
}> {
  const result = await read<{
    bookmarks: number;
    authors: number;
    topics: number;
    curated: number;
  }>(`
    OPTIONAL MATCH (b:Bookmark)
    WITH count(b) AS bookmarks,
         count(CASE WHEN b.visibility = 'curated' THEN 1 END) AS curated
    OPTIONAL MATCH (a:Author)
    WITH bookmarks, curated, count(a) AS authors
    OPTIONAL MATCH (t:Topic)
    RETURN bookmarks, curated, authors, count(t) AS topics
  `);
  return result.records[0]?.toObject() ?? { bookmarks: 0, authors: 0, topics: 0, curated: 0 };
}

export async function getBookmark(xPostId: string): Promise<BookmarkDetail | null> {
  const result = await read<Omit<BookmarkDetail, "publicMetrics"> & { publicMetrics: string | null }>(
    `
    MATCH (b:Bookmark {xPostId: $xPostId})
    OPTIONAL MATCH (b)-[:ABOUT]->(t:Topic)
    WITH b, collect(DISTINCT t.name) AS topics
    RETURN ${SUMMARY_PROJECTION},
      b.conversationId AS conversationId,
      b.publicMetrics AS publicMetrics,
      toString(b.ingestedAt) AS ingestedAt,
      toString(b.updatedAt) AS updatedAt
    `,
    { xPostId },
  );

  const row = result.records[0]?.toObject();
  if (!row) return null;

  let publicMetrics: Record<string, unknown> | null = null;
  if (row.publicMetrics) {
    try {
      publicMetrics = JSON.parse(row.publicMetrics) as Record<string, unknown>;
    } catch {
      publicMetrics = null;
    }
  }

  return { ...row, publicMetrics };
}

/** Explicit RELATED_TO edges, matched in both directions. */
export async function getRelated(xPostId: string, limit = 12): Promise<BookmarkSummary[]> {
  const result = await read<BookmarkSummary>(
    `
    MATCH (:Bookmark {xPostId: $xPostId})-[:RELATED_TO]-(b:Bookmark)
    OPTIONAL MATCH (b)-[:ABOUT]->(t:Topic)
    WITH b, collect(DISTINCT t.name) AS topics
    RETURN ${SUMMARY_PROJECTION}
    ORDER BY b.createdAt DESC
    LIMIT toInteger($limit)
    `,
    { xPostId, limit },
  );
  return result.records.map((record) => record.toObject());
}

/**
 * Inferred neighbours: bookmarks reachable through a shared Topic, ranked by how many
 * topics they share. This is the payoff for storing topics as nodes instead of a
 * string array — navigation without anyone hand-asserting every relation.
 */
export async function getTopicNeighbours(
  xPostId: string,
  limit = 8,
): Promise<(BookmarkSummary & { shared: string[] })[]> {
  const result = await read<BookmarkSummary & { shared: string[] }>(
    `
    MATCH (origin:Bookmark {xPostId: $xPostId})-[:ABOUT]->(shared:Topic)<-[:ABOUT]-(b:Bookmark)
    WHERE b.xPostId <> origin.xPostId
      AND NOT EXISTS { (origin)-[:RELATED_TO]-(b) }
    WITH b, collect(DISTINCT shared.name) AS shared
    OPTIONAL MATCH (b)-[:ABOUT]->(t:Topic)
    WITH b, shared, collect(DISTINCT t.name) AS topics
    RETURN ${SUMMARY_PROJECTION}, shared
    ORDER BY size(shared) DESC, b.createdAt DESC
    LIMIT toInteger($limit)
    `,
    { xPostId, limit },
  );
  return result.records.map((record) => record.toObject());
}

export async function listFolders(): Promise<Facet[]> {
  const result = await read<Facet>(`
    MATCH (b:Bookmark)
    WHERE b.folder IS NOT NULL
    RETURN b.folder AS value, count(*) AS count
    ORDER BY count DESC, value ASC
  `);
  return result.records.map((record) => record.toObject());
}

export async function listSources(): Promise<Facet[]> {
  const result = await read<Facet>(`
    MATCH (b:Bookmark)
    RETURN b.source AS value, count(*) AS count
    ORDER BY count DESC, value ASC
  `);
  return result.records.map((record) => record.toObject());
}

export async function listTopics(limit = 40): Promise<Facet[]> {
  const result = await read<Facet>(
    `
    MATCH (t:Topic)<-[:ABOUT]-(b:Bookmark)
    RETURN t.name AS value, count(b) AS count
    ORDER BY count DESC, value ASC
    LIMIT toInteger($limit)
    `,
    { limit },
  );
  return result.records.map((record) => record.toObject());
}

export async function listAuthors(limit = 40): Promise<Facet[]> {
  const result = await read<Facet>(
    `
    MATCH (a:Author)<-[:BY]-(b:Bookmark)
    RETURN a.handle AS value, count(b) AS count
    ORDER BY count DESC, value ASC
    LIMIT toInteger($limit)
    `,
    { limit },
  );
  return result.records.map((record) => record.toObject());
}

export async function graphIsReachable(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await read("RETURN 1 AS ok");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
