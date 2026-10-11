import { getDriver, write } from "./neo4j";
import { neo4jConfig } from "./env";
import { ensureProjectDocs } from "./project-docs";

/**
 * The graph's DDL. Every statement is `IF NOT EXISTS`, so `npm run schema` is safe to
 * re-run and is the documented boot step for a fresh Aura instance or local container.
 * After constraints it MERGEs the two ProjectDoc nodes (roadmap, changelog) without
 * overwriting an existing body.
 */
export const SCHEMA_STATEMENTS: string[] = [
  // Node keys — these are what make ingest idempotent.
  `CREATE CONSTRAINT bookmark_x_post_id IF NOT EXISTS
     FOR (b:Bookmark) REQUIRE b.xPostId IS UNIQUE`,
  `CREATE CONSTRAINT author_handle IF NOT EXISTS
     FOR (a:Author) REQUIRE a.handle IS UNIQUE`,
  `CREATE CONSTRAINT topic_name IF NOT EXISTS
     FOR (t:Topic) REQUIRE t.name IS UNIQUE`,
  `CREATE CONSTRAINT project_doc_slug IF NOT EXISTS
     FOR (d:ProjectDoc) REQUIRE d.slug IS UNIQUE`,

  // Explorer access paths: listing order, folder/source/visibility filters.
  `CREATE INDEX bookmark_created_at IF NOT EXISTS FOR (b:Bookmark) ON (b.createdAt)`,
  `CREATE INDEX bookmark_folder IF NOT EXISTS FOR (b:Bookmark) ON (b.folder)`,
  `CREATE INDEX bookmark_source IF NOT EXISTS FOR (b:Bookmark) ON (b.source)`,
  `CREATE INDEX bookmark_visibility IF NOT EXISTS FOR (b:Bookmark) ON (b.visibility)`,

  // Search. No embeddings in v1 — full text over the post body is the whole search story.
  `CREATE FULLTEXT INDEX bookmark_text IF NOT EXISTS
     FOR (b:Bookmark) ON EACH [b.text, b.authorHandle]`,
];

export async function applySchema(): Promise<string[]> {
  const applied: string[] = [];
  for (const statement of SCHEMA_STATEMENTS) {
    await write(statement);
    applied.push(statement.split("\n")[0].trim());
  }

  const { database } = neo4jConfig();
  const session = getDriver().session({ database });
  try {
    await session.run("CALL db.awaitIndexes(300)");
  } finally {
    await session.close();
  }

  const seeded = await ensureProjectDocs();
  for (const slug of seeded.created) {
    applied.push(`seeded ProjectDoc slug=${slug}`);
  }
  for (const slug of seeded.existing) {
    applied.push(`kept ProjectDoc slug=${slug}`);
  }

  return applied;
}
