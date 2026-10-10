# Bookmark Graph

A private knowledge graph over Alan Garcia's (`@alangnative`) X bookmarks: Neo4j for the
graph, a thin Next.js explorer for navigating it, and one idempotent ingest surface that a
separate **X Bookmarks** agent calls.

**X stays the source of truth for bookmarks. This repo never calls the X API.** It owns the
schema, the upsert, and the private explorer — nothing else. Read
[CONTEXT.md](./CONTEXT.md) for the data model and the explicit list of what v1 does not build.

```
X API ──▶ X Bookmarks agent ──▶ POST /api/ingest ──▶ Neo4j ──▶ private Next.js explorer
          (separate repo)        (this repo)
```

## Quickstart

Primary local path is Docker Neo4j. (Aura works identically — see below — but a free Aura
instance auto-pauses, which is annoying while developing.)

```bash
cp .env.example .env.local     # the defaults match docker-compose.yml
npm install
npm run neo4j:up               # Neo4j 5.26 on bolt://localhost:7687
npm run schema                 # constraints + indexes, idempotent
npm run ingest -- fixtures/demo-bookmarks.json   # labeled DEMO data, not real bookmarks
npm run dev
```

Open the app, sign in with the `APP_ACCESS_SECRET` value (`dev-local-access` if you left it
unset locally).

To start from an empty graph instead, skip the ingest step — the explorer has an empty state
that tells you what to do next.

### Removing the demo data

```bash
# in Neo4j Browser (http://localhost:7474) or cypher-shell
MATCH (b:Bookmark) WHERE b.xPostId STARTS WITH 'demo-' DETACH DELETE b;
```

## Environment variables

Copy `.env.example` to `.env.local`. Nothing secret is committed; `.env*` is gitignored
except the example.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEO4J_URI` | yes | `bolt://localhost:7687` locally, `neo4j+s://xxxx.databases.neo4j.io` for Aura. |
| `NEO4J_USER` | yes | Defaults to `neo4j`. |
| `NEO4J_PASSWORD` | yes | No default — the app fails loudly without it. |
| `NEO4J_DATABASE` | no | Defaults to `neo4j`. |
| `APP_ACCESS_SECRET` | prod | Explorer passphrase. Falls back to `dev-local-access` outside production; **unset in production locks the app**, it does not open it. |
| `INGEST_TOKEN` | yes | Bearer token for `POST /api/ingest`. Generate with `openssl rand -hex 32`. |

## Neo4j Aura setup

1. Sign up at [console.neo4j.io](https://console.neo4j.io) and create a **free AuraDB** instance.
2. Aura shows the generated password **once** — download the credentials file or copy it then.
3. Put the connection URI (it starts with `neo4j+s://`), username, and password into
   `.env.local`, or into your Vercel project's environment variables.
4. Run `npm run schema` against it once. It is idempotent, so re-running after a schema
   change is safe.

Free instances pause after a few days idle; resume from the console if the explorer reports
it can't reach the graph.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Explorer at `http://localhost:3000`. |
| `npm run schema` | Applies constraints and indexes, and seeds `ProjectDoc` nodes if missing. Idempotent. |
| `npm run ingest -- <file.json>` | Batch ingest. `-` reads stdin. |
| `npm run allowlist -- add <xPostId...>` | The **only** way to set `visibility: curated`. |
| `npm run allowlist -- remove <xPostId...>` | Back to `private`. |
| `npm run typecheck` / `npm run lint` / `npm run build` | The gates CI would run. |
| `npm run neo4j:up` / `npm run neo4j:down` | Local Neo4j container. |

## Ingest: how the X Bookmarks agent calls this

One contract, two entrypoints over the same function (`src/lib/ingest.ts`). The HTTP route is
what the agent should use.

```
POST /api/ingest
Authorization: Bearer $INGEST_TOKEN
Content-Type: application/json
```

Body is `{ "bookmarks": [ ... ] }` or a bare array.

### Fields

| Field | Required | Notes |
| --- | --- | --- |
| `xPostId` | yes | The upsert key. Aliases accepted: `id`, `post_id`. |
| `url` | yes | Defaults to `https://x.com/<handle>/status/<id>` if omitted. |
| `text` | yes | Post body. |
| `authorHandle` | yes | With or without `@`. Aliases: `author_handle`, `author`, `author.username`. |
| `createdAt` | yes | ISO-8601, or epoch seconds/ms. Alias: `created_at`. |
| `conversationId` | no | Alias: `conversation_id`. |
| `folder` | no | X bookmark folder name: `RN`, `GPTs Custom`, `AVP`, `AIBOOM`, `Courses`, `OPEX`. Alias: `folder_name`. |
| `publicMetrics` | no | Any object; stored as JSON. Alias: `public_metrics`. |
| `source` | no | `x` (bookmarks API) or `grok-from-x` (Grok-surfaced). Defaults to `x`. These are **distinct provenances** — `grok-from-x` is not the X bookmark API path. |
| `topics` | no | String or array. Aliases: `tags`, `entities`. Lowercased on write. |
| `relatedTo` | no | Array of other `xPostId`s. Alias: `related_to`. |
| `visibility` | no | Only `private` is accepted. Sending `curated` is **rejected** — see below. |

### Example

```bash
curl -sS -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "bookmarks": [{
      "xPostId": "1839201234567890123",
      "url": "https://x.com/someone/status/1839201234567890123",
      "text": "Thread on Fabric renderer migration gotchas.",
      "authorHandle": "someone",
      "createdAt": "2026-09-02T09:41:00.000Z",
      "conversationId": "1839201234567890000",
      "folder": "RN",
      "publicMetrics": { "like_count": 930, "reply_count": 44 },
      "source": "x",
      "topics": ["react native", "new architecture"],
      "relatedTo": ["1839200000000000001"]
    }]
  }'
```

Response:

```json
{
  "received": 1, "created": 1, "updated": 0,
  "authors": 1, "topics": 2,
  "relationsLinked": 0,
  "relationsSkipped": [{ "from": "1839201234567890123", "to": "1839200000000000001" }],
  "errors": []
}
```

### Behaviour the agent can rely on

- **Idempotent.** Re-posting an identical batch creates nothing new and changes nothing
  semantically. Safe to retry; safe to re-send a whole folder.
- **Partial failure is per item.** A malformed bookmark lands in `errors` with its index and
  reason; the rest of the batch still commits. HTTP 400 only when *nothing* in the batch was
  usable.
- **Relations need both endpoints.** A `relatedTo` id that isn't in the graph yet comes back
  in `relationsSkipped` rather than creating a placeholder node. Re-send after the other
  bookmark lands, or put both in the same batch.
- **Topics and relations are additive.** Omitting a topic on a later pass does not remove it.
- **Omitted optional fields don't erase known values.** `folder`, `conversationId`, and
  `publicMetrics` use `coalesce`, so an enrichment pass can't null out what ingest already knows.
- **Ingest can never publish.** `visibility` is set to `private` once, on create. There is no
  statement in the ingest path that can write `curated`, and a payload asking for it is
  rejected with an explicit error. Curation happens only via
  `npm run allowlist -- add <xPostId>`.

## Deploying to Vercel

1. Import the repo, framework preset Next.js.
2. Set `NEO4J_URI` (the `neo4j+s://` Aura URI), `NEO4J_USER`, `NEO4J_PASSWORD`,
   `NEO4J_DATABASE` (Aura's database name is the instance id), `APP_ACCESS_SECRET`,
   and `INGEST_TOKEN` in Project Settings → Environment Variables.
3. Deploy, then give the X Bookmarks agent the deployment URL and `INGEST_TOKEN`.

The explorer is private by default: `src/proxy.ts` redirects every route except `/login` and
`/api/ingest` to the passphrase gate. `/roadmap` and `/changelog` are the only extra
exception, and only when that doc's `isPublic` flag is true in Neo4j. Edit paths
(`/roadmap/edit`, `/changelog/edit`) and every bookmark route stay gated.

### Swapping in real auth

v1 ships a single shared passphrase, deliberately. To replace it, change these files —
bookmark queries never read the session:

- `src/lib/auth.ts` — the session check (`isValidSession`) and the sign-in check.
- `src/lib/session.ts` — the cookie read used by ProjectDoc pages.
- `src/proxy.ts` — the redirect rule.

A NextAuth or Clerk middleware drops straight into `src/proxy.ts`; delete `src/app/login`
and point at the provider's sign-in route. Keep `/api/ingest` on its bearer token — it is a
machine caller, not a user session.

## Done for v1

v1 is complete, and these are the things it is expected to do:

- `npm install && npm run typecheck && npm run lint && npm run build` pass.
- `npm run schema` creates every constraint and index on a fresh database and is safe to re-run.
  It also creates `ProjectDoc` nodes for `/roadmap` and `/changelog` on first run (never
  overwrites an edited body).
- `npm run ingest` and `POST /api/ingest` upsert the same way, idempotently, keyed on `xPostId`.
- Re-ingesting a bookmark the allowlist promoted leaves it `curated`; ingest asking for
  `curated` is rejected.
- The explorer, behind the gate, lists and searches bookmarks, filters by folder / source /
  topic / author, and navigates from one bookmark to its `RELATED_TO` neighbours and to
  bookmarks sharing a `Topic`.
- No secrets in the repo.

Everything beyond that — live X ingest, Notion mirroring, a public curated surface, graph
visualization — is explicitly out of scope and listed in
[CONTEXT.md](./CONTEXT.md#2-what-v1-deliberately-does-not-build).

Verified against Neo4j 5.26 (the version in `docker-compose.yml`).

## Roadmap and Changelog

Two `ProjectDoc` nodes in Neo4j (`slug` is `roadmap` or `changelog`). Markdown `body`,
`isPublic` (default `false`), and `updatedAt`. Admin edits take effect on the next request —
no redeploy.

| Route | Who |
| --- | --- |
| `/roadmap`, `/changelog` | Signed-in always; guests only when that doc is public |
| `/roadmap/edit`, `/changelog/edit` | Signed-in only |

To publish a doc: sign in, open Edit, check **Public**, save. Signed-in nav always shows
both links. The login page shows a subtle link only for docs that are currently public.

Guest-visible pages render only the ProjectDoc body. They do not query bookmarks, authors,
or topics.
