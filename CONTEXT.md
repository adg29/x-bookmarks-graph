# CONTEXT — Bookmark Knowledge Graph (v1)

Private bookmark knowledge graph for Alan Garcia (`@alangnative`).

X is the raw source of truth for bookmarks. This repo is **not** an X client: it owns the
graph schema, an idempotent ingest surface, and one private explorer. A separate agent
("X Bookmarks") owns live reading/enrichment from the X API and calls the ingest surface here.

## 1. The graph model

This is the locked ingest contract. It is deliberately small: four labels' worth of concepts
collapsed into three node types and three edge types.

### Nodes

**`Bookmark`** — keyed on `xPostId` (unique constraint). One node per bookmarked X post.

| Property | Type | Notes |
| --- | --- | --- |
| `xPostId` | string | **Key.** The X post id. All upserts match on this alone. |
| `url` | string | Canonical post URL. |
| `text` | string | Post text. |
| `authorHandle` | string | Denormalized on the bookmark *and* modeled as a `BY` edge. Kept on the node so listing does not require a join. |
| `createdAt` | datetime | Post creation time, stored as a Neo4j `datetime` so ordering and range queries are native. Accepts ISO-8601 or epoch seconds/ms on input. |
| `conversationId` | string | X conversation id. Lets a thread be reassembled later without a new edge type. |
| `folder` | string | X bookmark folder name (`RN`, `GPTs Custom`, `AVP`, `AIBOOM`, `Courses`, `OPEX`). A scalar, **not** a node — see non-goals. |
| `publicMetrics` | string (JSON) | Neo4j properties cannot hold maps, so the metrics object is stored as a JSON string and parsed at the app edge. One property, one name, matching the contract. |
| `source` | string | `x` \| `grok-from-x`. `grok-from-x` means the item arrived via Grok's view of X, which is a *different provenance* from the X bookmarks API. Never conflated. |
| `visibility` | string | `private` \| `curated`. **Defaults to `private`.** |
| `ingestedAt` / `updatedAt` | datetime | Set by ingest; `ingestedAt` only on create. |

**`Author`** — keyed on `handle` (unique constraint). Optional `name` enriched later.

**`Topic`** — keyed on `name` (unique constraint). Topics come from tags/entities supplied by
the ingesting agent. Lowercased-trimmed on write so `RN` and `rn` are one topic.

### Edges

- `(:Bookmark)-[:BY]->(:Author)` — authorship.
- `(:Bookmark)-[:ABOUT]->(:Topic)` — subject matter, one per tag/entity.
- `(:Bookmark)-[:RELATED_TO]->(:Bookmark)` — explicit relation asserted by the ingesting agent.
  Treated as undirected when read (queries match both directions); written in one direction only
  so there is exactly one edge per pair.

### Invariants

1. **Idempotent.** Re-ingesting the same payload produces no new nodes or edges and no
   semantic change. `MERGE` on the key properties, `SET` on the rest.
2. **Visibility is not ingest's business.** Ingest may create a bookmark as `private` (the
   default) and may never raise an existing bookmark to `curated`. Promotion to `curated` only
   happens through an explicit allowlist action (`scripts/allowlist.ts`), which is the single
   code path permitted to write `visibility = 'curated'`. Demotion back to `private` is always
   allowed.
3. **`source` is provenance, not a flag.** `x` and `grok-from-x` are distinct values on the
   same node type; neither implies the other's API path.

## 2. What v1 deliberately does NOT build

Subtracting these is the point of v1, not an oversight.

- **No live X API calls from this repo.** No tokens, no fetching, no scheduling. Ingest is a
  push surface. The X Bookmarks agent reads X and POSTs here.
- **No `Folder` node.** Folders are a flat, closed set of six strings with no relationships of
  their own. A node would buy nothing an indexed property doesn't. Multi-folder membership is
  not modeled; if X starts returning several folders per post, `folder` becomes a relationship
  then, not now.
- **No Notion store or sync.** Notion is at most a personal mirror later. Neo4j is the graph.
- **No real auth provider.** A single-secret cookie gate (`APP_ACCESS_SECRET`) keeps the
  explorer private. Swapping in NextAuth/Clerk means replacing one module
  (`src/lib/auth.ts`) — documented in the README.
- **No public product.** `visibility: curated` exists as a field and an allowlist script so the
  concept is real and enforceable, but there is no public route, no marketing site, no
  share flow.
- **No graph visualization.** The explorer is a list, a detail page, and links. Navigating
  edges by clicking is the whole feature. No canvas, no force layout, no D3.
- **No embeddings / vector index / LLM enrichment.** Search is a Neo4j full-text index over
  `text`. Enrichment (topics, relations) is the ingesting agent's job; this repo just stores
  what it is given.
- **No fabricated bookmarks.** The only local data is `fixtures/demo-bookmarks.json`, which is
  explicitly labeled demo and contains no real captured bookmarks.

## 3. The smallest surface

Three pieces, in dependency order:

1. **Schema** — `npm run schema` applies constraints and indexes (idempotent, safe to re-run).
   Uniqueness on `Bookmark.xPostId`, `Author.handle`, `Topic.name`; range indexes on
   `folder`, `visibility`, `createdAt`, `source`; a full-text index on `Bookmark.text`.
2. **Ingest** — one contract, two entrypoints over the same function
   (`ingestBookmarks()` in `src/lib/ingest.ts`):
   - `npm run ingest -- <file.json>` for local/batch use.
   - `POST /api/ingest` with `Authorization: Bearer $INGEST_TOKEN` for the X Bookmarks agent.
   Body is `{ bookmarks: [...] }` or a bare array. Returns per-item created/updated counts.
3. **Explorer** (private, all routes behind the gate):
   - `/` — listing with search, folder filter, source filter.
   - `/b/[xPostId]` — detail: full text, metrics, author, topics, related bookmarks.
   - `/author/[handle]`, `/topic/[name]`, `/folder/[folder]` — navigation driven by the edges.

Everything else is explicitly later.

## 4. How the X Bookmarks agent integrates

That agent owns: X API auth, folder enumeration, pagination, dedup against its own cursor,
and enrichment (topics, related pairs). It does not need to know Cypher. It POSTs batches to
`/api/ingest` with the bearer token, mapping X fields to the contract above and setting
`source` to `x` (bookmarks API) or `grok-from-x` (Grok-surfaced). It never sets `visibility`.

See the README for the exact payload shape and a copy-pasteable example.
