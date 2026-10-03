/**
 * The explicit allowlist action. Ingest can never promote a bookmark to `curated`;
 * this script is the only way.
 *
 *   npm run allowlist -- add 1800000000000000001 1800000000000000002
 *   npm run allowlist -- remove 1800000000000000001
 */
import { loadEnv } from "./load-env";

loadEnv();

import { curate, unCurate } from "../src/lib/allowlist";
import { closeDriver } from "../src/lib/neo4j";

async function main() {
  const [action, ...xPostIds] = process.argv.slice(2);

  if (action !== "add" && action !== "remove") {
    throw new Error("Usage: npm run allowlist -- <add|remove> <xPostId...>");
  }
  if (xPostIds.length === 0) {
    throw new Error("At least one xPostId is required");
  }

  const changed = action === "add" ? await curate(xPostIds) : await unCurate(xPostIds);

  for (const row of changed) {
    console.log(`  ${row.xPostId} -> ${row.visibility}`);
  }

  const missing = xPostIds.filter((id) => !changed.some((row) => row.xPostId === id));
  if (missing.length > 0) {
    console.error(`\nNot found in the graph: ${missing.join(", ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`\nAllowlist failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(closeDriver);
