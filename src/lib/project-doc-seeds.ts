/**
 * First-run copy for ProjectDoc nodes. Only facts that are already true of this
 * repo or that the project has already recorded — no invented metrics or dates.
 */

export const CHANGELOG_SEED = `What this repo has actually shipped. Dated entries match git history on \`main\`.

## 2026-10-03 — Schema and ingest contract

- Locked the v1 graph: \`Bookmark\`, \`Author\`, and \`Topic\` nodes with \`BY\`, \`ABOUT\`, and \`RELATED_TO\` edges.
- Idempotent upsert keyed on \`Bookmark.xPostId\`. Re-ingesting the same payload does not create new nodes or change meaning.
- \`npm run schema\` applies uniqueness constraints and indexes and is safe to re-run.
- One ingest function, two doors: \`npm run ingest\` and \`POST /api/ingest\` with \`Authorization: Bearer $INGEST_TOKEN\`.
- Ingest may only write \`visibility: private\`. \`curated\` is set only by \`npm run allowlist\`.
- This repo does not call the X API. The X Bookmarks agent reads X and pushes batches here.

## Private bookmark import

- One-shot private import into Aura: about 200 bookmarks and about 169 authors.
- The explorer was not used as an X client. The set arrived through the ingest surface.

## Explorer on Vercel

- Private explorer is at [x-bookmarks-graph.vercel.app](https://x-bookmarks-graph.vercel.app).
- Routes sit behind the \`APP_ACCESS_SECRET\` cookie gate (\`src/lib/auth.ts\` + \`src/proxy.ts\`).
- \`/api/ingest\` stays on its own bearer token so the agent can post without a browser session.
`;

export const ROADMAP_SEED = `Next work — not claimed as done.

## GitHub → Vercel reconnect

Reconnect the GitHub repo to the Vercel project so a push to \`main\` deploys without a manual import.

## Folder membership on re-ingest

Keep folder assignment correct when a bookmark is ingested again. \`folder\` is still a scalar on \`Bookmark\` (the six X folders in use: RN, GPTs Custom, AVP, AIBOOM, Courses, OPEX). Multi-folder membership is not modeled.

## Curated allowlist / optional public bookmark surface

\`visibility: curated\` and \`scripts/allowlist.ts\` already exist. There is still no public bookmark route. A later surface could list only curated items without opening the private graph.

## Ongoing X sync

Live, incremental bookmark sync is the X Bookmarks agent's job. This repo remains a push target (\`POST /api/ingest\`), not an X client.

## grok-from-x source

\`source\` already accepts \`x\` and \`grok-from-x\` as distinct provenances. Wiring the Grok-surfaced path from the ingesting agent is still ahead.

## Richer explore views

v1 is a list, a detail page, and links along stored edges. Richer views (author / topic / folder pages, better search) come later. No graph canvas in v1.
`;
