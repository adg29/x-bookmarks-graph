/**
 * Batch ingest entrypoint. Same function the authenticated route calls.
 *
 *   npm run ingest -- fixtures/demo-bookmarks.json
 *   cat batch.json | npm run ingest -- -
 */
import { readFileSync } from "node:fs";

import { loadEnv } from "./load-env";

loadEnv();

import { ingestBookmarks } from "../src/lib/ingest";
import { closeDriver } from "../src/lib/neo4j";

function readInput(path: string | undefined): string {
  if (!path) {
    throw new Error("Usage: npm run ingest -- <file.json>   (use - to read stdin)");
  }
  return path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8");
}

async function main() {
  const raw = readInput(process.argv[2]);
  const result = await ingestBookmarks(JSON.parse(raw));

  console.log(
    [
      `received ${result.received}`,
      `created ${result.created}`,
      `updated ${result.updated}`,
      `authors ${result.authors}`,
      `topics ${result.topics}`,
      `related ${result.relationsLinked}`,
    ].join("  "),
  );

  if (result.relationsSkipped.length > 0) {
    console.log(`\n${result.relationsSkipped.length} relation(s) skipped (unknown endpoint):`);
    for (const rel of result.relationsSkipped) {
      console.log(`  ${rel.from} -> ${rel.to}`);
    }
  }

  if (result.errors.length > 0) {
    console.error(`\n${result.errors.length} item(s) rejected:`);
    for (const error of result.errors) {
      console.error(`  [${error.index}] ${error.xPostId ?? "(no id)"}: ${error.message}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`\nIngest failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(closeDriver);
