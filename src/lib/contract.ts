import { z } from "zod";

/**
 * The ingest contract. This is the single definition of what a bookmark is in this
 * repo; schema, ingest, and the explorer all derive from it.
 *
 * Canonical keys are camelCase. Because callers map straight off X API payloads, the
 * snake_case spellings X uses are accepted as aliases for the fields where the names
 * differ, and normalized away before anything touches Neo4j.
 */

export const SOURCES = ["x", "grok-from-x"] as const;
export type Source = (typeof SOURCES)[number];

export const VISIBILITIES = ["private", "curated"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** The X bookmark folders in use. Not a closed set at the type level — new folders ingest fine. */
export const KNOWN_FOLDERS = ["RN", "GPTs Custom", "AVP", "AIBOOM", "Courses", "OPEX"] as const;

const nonEmpty = z.string().trim().min(1);

/** X returns ISO-8601; epoch seconds/ms are accepted so callers need no date library. */
const createdAtInput = z.union([nonEmpty, z.number()]);

const publicMetricsInput = z.record(z.string(), z.unknown());

const stringList = z.union([nonEmpty, z.array(nonEmpty)]);

export const bookmarkInputSchema = z
  .object({
    xPostId: nonEmpty.optional(),
    id: nonEmpty.optional(),
    post_id: nonEmpty.optional(),

    url: nonEmpty.optional(),

    text: z.string().optional(),

    authorHandle: nonEmpty.optional(),
    author_handle: nonEmpty.optional(),
    author: z.union([nonEmpty, z.object({ username: nonEmpty.optional() })]).optional(),

    createdAt: createdAtInput.optional(),
    created_at: createdAtInput.optional(),

    conversationId: nonEmpty.optional(),
    conversation_id: nonEmpty.optional(),

    folder: nonEmpty.optional(),
    folder_name: nonEmpty.optional(),

    publicMetrics: publicMetricsInput.optional(),
    public_metrics: publicMetricsInput.optional(),

    source: z.enum(SOURCES).optional(),

    /** Accepted so a mistaken `curated` is rejected loudly instead of silently ignored. */
    visibility: z.string().optional(),

    topics: stringList.optional(),
    tags: stringList.optional(),
    entities: stringList.optional(),

    relatedTo: stringList.optional(),
    related_to: stringList.optional(),
  })
  .loose();

export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;

export const ingestBodySchema = z.union([
  z.object({ bookmarks: z.array(bookmarkInputSchema) }),
  z.array(bookmarkInputSchema),
]);

/** A row ready for Cypher: flat, every value a Neo4j-storable primitive. */
export type BookmarkRow = {
  xPostId: string;
  url: string;
  text: string;
  authorHandle: string;
  createdAt: string;
  conversationId: string | null;
  folder: string | null;
  publicMetrics: string | null;
  source: Source;
  topics: string[];
};

export type RelationRow = { from: string; to: string };

export type NormalizeResult = {
  rows: BookmarkRow[];
  relations: RelationRow[];
  errors: { index: number; xPostId?: string; message: string }[];
};

function firstDefined<T>(...values: (T | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

function toList(...values: (string | string[] | undefined)[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (value === undefined) continue;
    if (Array.isArray(value)) out.push(...value);
    else out.push(value);
  }
  return out;
}

/** Topics are lowercased and trimmed on write so `RN` and `rn` are one Topic node. */
export function normalizeTopic(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeAuthorHandle(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

function toIsoDate(raw: string | number): string {
  if (typeof raw === "number") {
    // Epoch seconds vs milliseconds: anything below ~1e12 is seconds.
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) throw new Error(`createdAt is not a valid timestamp: ${raw}`);
    return date.toISOString();
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error(`createdAt is not a valid date: ${raw}`);
  return date.toISOString();
}

function postUrl(handle: string, xPostId: string): string {
  return `https://x.com/${handle}/status/${xPostId}`;
}

/**
 * Validates and flattens caller payloads into Cypher-ready rows.
 *
 * Bad items are collected rather than thrown so one malformed bookmark cannot block a
 * whole batch. Duplicate ids inside a batch collapse to the last occurrence.
 */
export function normalizeBatch(input: unknown): NormalizeResult {
  const parsed = ingestBodySchema.safeParse(input);
  if (!parsed.success) {
    return {
      rows: [],
      relations: [],
      errors: [{ index: -1, message: `Malformed batch: ${parsed.error.issues[0]?.message ?? "invalid"}` }],
    };
  }

  const items = Array.isArray(parsed.data) ? parsed.data : parsed.data.bookmarks;
  const byId = new Map<string, BookmarkRow>();
  const relationKeys = new Set<string>();
  const relations: RelationRow[] = [];
  const errors: NormalizeResult["errors"] = [];

  items.forEach((item, index) => {
    const xPostId = firstDefined(item.xPostId, item.id, item.post_id);
    try {
      if (!xPostId) throw new Error("xPostId is required (accepted aliases: id, post_id)");

      if (item.visibility !== undefined && item.visibility !== "private") {
        throw new Error(
          `ingest cannot set visibility='${item.visibility}'. Visibility defaults to 'private'; ` +
            "promotion to 'curated' only happens through the allowlist action.",
        );
      }

      const authorRaw = firstDefined(
        item.authorHandle,
        item.author_handle,
        typeof item.author === "string" ? item.author : item.author?.username,
      );
      if (!authorRaw) throw new Error("authorHandle is required");
      const authorHandle = normalizeAuthorHandle(authorRaw);

      const text = item.text;
      if (text === undefined) throw new Error("text is required");

      const createdAtRaw = firstDefined(item.createdAt, item.created_at);
      if (createdAtRaw === undefined) throw new Error("createdAt is required");

      const metrics = firstDefined(item.publicMetrics, item.public_metrics);

      const topics = Array.from(
        new Set(toList(item.topics, item.tags, item.entities).map(normalizeTopic).filter(Boolean)),
      );

      byId.set(xPostId, {
        xPostId,
        url: firstDefined(item.url) ?? postUrl(authorHandle, xPostId),
        text,
        authorHandle,
        createdAt: toIsoDate(createdAtRaw),
        conversationId: firstDefined(item.conversationId, item.conversation_id) ?? null,
        folder: firstDefined(item.folder, item.folder_name) ?? null,
        publicMetrics: metrics ? JSON.stringify(metrics) : null,
        source: item.source ?? "x",
        topics,
      });

      for (const target of toList(item.relatedTo, item.related_to)) {
        if (target === xPostId) continue;
        // One edge per pair, regardless of which side asserted it.
        const key = [xPostId, target].sort().join("::");
        if (relationKeys.has(key)) continue;
        relationKeys.add(key);
        relations.push({ from: xPostId, to: target });
      }
    } catch (error) {
      errors.push({
        index,
        xPostId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return { rows: [...byId.values()], relations, errors };
}
