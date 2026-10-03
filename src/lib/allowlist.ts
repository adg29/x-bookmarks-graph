import { write } from "./neo4j";

/**
 * The only code path permitted to write `visibility = 'curated'`.
 *
 * Curation is a deliberate human act, never a side effect of ingest. v1 ships the
 * enforcement and the audit trail (`curatedAt`) but no public surface that reads it —
 * see CONTEXT.md non-goals.
 */

export type AllowlistChange = { xPostId: string; visibility: string };

export async function curate(xPostIds: string[]): Promise<AllowlistChange[]> {
  const result = await write<AllowlistChange>(
    `
    UNWIND $xPostIds AS xPostId
    MATCH (b:Bookmark {xPostId: xPostId})
    SET b.visibility = 'curated',
        b.curatedAt = coalesce(b.curatedAt, datetime())
    RETURN b.xPostId AS xPostId, b.visibility AS visibility
    `,
    { xPostIds },
  );
  return result.records.map((record) => record.toObject());
}

export async function unCurate(xPostIds: string[]): Promise<AllowlistChange[]> {
  const result = await write<AllowlistChange>(
    `
    UNWIND $xPostIds AS xPostId
    MATCH (b:Bookmark {xPostId: xPostId})
    SET b.visibility = 'private'
    REMOVE b.curatedAt
    RETURN b.xPostId AS xPostId, b.visibility AS visibility
    `,
    { xPostIds },
  );
  return result.records.map((record) => record.toObject());
}
