import { normalizeBatch, type NormalizeResult } from "./contract";
import { writeTx } from "./neo4j";

/**
 * The one ingest implementation. Both entrypoints — `npm run ingest` and
 * `POST /api/ingest` — call this; there is no second code path.
 */

/**
 * Upsert the Bookmark nodes.
 *
 * `visibility` is set only `ON CREATE`, and only ever to 'private'. A bookmark the
 * allowlist promoted to 'curated' keeps that value through any number of re-ingests:
 * ingest contains no statement that can write 'curated'.
 *
 * Optional fields use `coalesce(row.x, b.x)` so a payload that omits `folder` or
 * `conversationId` leaves previously known values intact instead of nulling them.
 */
const UPSERT_BOOKMARKS = `
UNWIND $rows AS row
MERGE (b:Bookmark {xPostId: row.xPostId})
  ON CREATE SET b.visibility = 'private',
                b.ingestedAt = datetime($now)
SET b.url = row.url,
    b.text = row.text,
    b.authorHandle = row.authorHandle,
    b.createdAt = datetime(row.createdAt),
    b.source = row.source,
    b.conversationId = coalesce(row.conversationId, b.conversationId),
    b.folder = coalesce(row.folder, b.folder),
    b.publicMetrics = coalesce(row.publicMetrics, b.publicMetrics),
    b.updatedAt = datetime($now)
RETURN b.xPostId AS xPostId, b.ingestedAt = datetime($now) AS created
`;

/** One BY edge per bookmark: any edge left over from a corrected handle is dropped. */
const UPSERT_AUTHORS = `
UNWIND $rows AS row
MATCH (b:Bookmark {xPostId: row.xPostId})
MERGE (a:Author {handle: row.authorHandle})
MERGE (b)-[:BY]->(a)
WITH b, a
OPTIONAL MATCH (b)-[stale:BY]->(other:Author)
WHERE other <> a
DELETE stale
`;

/** Topics are additive; removing a topic is an editing concern, not an ingest one. */
const UPSERT_TOPICS = `
UNWIND $rows AS row
UNWIND row.topics AS topicName
MATCH (b:Bookmark {xPostId: row.xPostId})
MERGE (t:Topic {name: topicName})
MERGE (b)-[:ABOUT]->(t)
`;

/**
 * Relations run after the bookmark upsert so two bookmarks in the same batch can
 * reference each other. Both endpoints must exist — an unknown id is reported as
 * skipped rather than conjuring a placeholder Bookmark node.
 *
 * The undirected MERGE yields exactly one RELATED_TO per pair, whichever side asserted it.
 */
const UPSERT_RELATIONS = `
UNWIND $relations AS rel
MATCH (from:Bookmark {xPostId: rel.from})
MATCH (to:Bookmark {xPostId: rel.to})
MERGE (from)-[:RELATED_TO]-(to)
RETURN rel.from AS from, rel.to AS to
`;

export type IngestResult = {
  received: number;
  created: number;
  updated: number;
  authors: number;
  topics: number;
  relationsLinked: number;
  relationsSkipped: { from: string; to: string }[];
  errors: NormalizeResult["errors"];
};

function pairKey(from: string, to: string): string {
  return [from, to].sort().join("::");
}

export async function ingestBookmarks(payload: unknown): Promise<IngestResult> {
  const { rows, relations, errors } = normalizeBatch(payload);

  const result: IngestResult = {
    received: rows.length,
    created: 0,
    updated: 0,
    authors: 0,
    topics: 0,
    relationsLinked: 0,
    relationsSkipped: [],
    errors,
  };

  if (rows.length === 0 && relations.length === 0) return result;

  await writeTx(async (run) => {
    if (rows.length > 0) {
      const now = new Date().toISOString();
      const upserted = await run<{ xPostId: string; created: boolean }>(UPSERT_BOOKMARKS, {
        rows,
        now,
      });
      for (const row of upserted) {
        if (row.created) result.created += 1;
        else result.updated += 1;
      }

      await run(UPSERT_AUTHORS, { rows });
      await run(UPSERT_TOPICS, { rows });

      result.authors = new Set(rows.map((row) => row.authorHandle)).size;
      result.topics = new Set(rows.flatMap((row) => row.topics)).size;
    }

    if (relations.length > 0) {
      const linked = await run<{ from: string; to: string }>(UPSERT_RELATIONS, { relations });
      const linkedKeys = new Set(linked.map((rel) => pairKey(rel.from, rel.to)));
      result.relationsLinked = linkedKeys.size;
      result.relationsSkipped = relations.filter((rel) => !linkedKeys.has(pairKey(rel.from, rel.to)));
    }
  });

  return result;
}
