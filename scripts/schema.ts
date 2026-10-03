/**
 * Applies constraints and indexes. Idempotent — run it against a fresh Aura instance or
 * a local container, and re-run it after any schema change.
 *
 *   npm run schema
 */
import { loadEnv } from "./load-env";

loadEnv();

import { applySchema } from "../src/lib/schema";
import { closeDriver, verifyConnectivity } from "../src/lib/neo4j";
import { neo4jConfig } from "../src/lib/env";

async function main() {
  const { uri, database } = neo4jConfig();
  console.log(`Applying schema to ${uri} (database: ${database})`);

  await verifyConnectivity();
  const applied = await applySchema();

  for (const statement of applied) {
    console.log(`  ok  ${statement}`);
  }
  console.log(`\n${applied.length} statements applied. Indexes are online.`);
}

main()
  .catch((error) => {
    console.error(`\nSchema failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(closeDriver);
