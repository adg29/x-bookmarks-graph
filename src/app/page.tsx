import Link from "next/link";

import { BookmarkCard } from "@/components/bookmark-card";
import { FacetList } from "@/components/facet-list";
import { GraphUnreachable } from "@/components/graph-unreachable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildQuery } from "@/lib/format";
import {
  countBookmarks,
  graphIsReachable,
  listAuthors,
  listBookmarks,
  listFolders,
  listSources,
  listTopics,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

export default async function ExplorerPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filters = {
    q: one(params.q),
    folder: one(params.folder),
    source: one(params.source),
    topic: one(params.topic),
    author: one(params.author),
    visibility: one(params.visibility),
  };

  const health = await graphIsReachable();
  if (!health.ok) {
    return (
      <Shell>
        <GraphUnreachable error={health.error} />
      </Shell>
    );
  }

  const [bookmarks, counts, folders, sources, topics, authors] = await Promise.all([
    listBookmarks(filters),
    countBookmarks(),
    listFolders(),
    listSources(),
    listTopics(24),
    listAuthors(16),
  ]);

  const activeFilters = Object.entries(filters).filter(([, value]) => Boolean(value));

  const sidebar = (
    <div className="space-y-6">
      <FacetList
        title="Folders"
        facets={folders}
        activeValue={filters.folder}
        hrefFor={(value) => buildQuery(filters, { folder: value })}
        clearHref={buildQuery(filters, { folder: undefined })}
        emptyLabel="No folders ingested yet."
      />
      <FacetList
        title="Source"
        facets={sources}
        activeValue={filters.source}
        hrefFor={(value) => buildQuery(filters, { source: value })}
        clearHref={buildQuery(filters, { source: undefined })}
      />
      <FacetList
        title="Topics"
        facets={topics}
        activeValue={filters.topic}
        hrefFor={(value) => buildQuery(filters, { topic: value })}
        clearHref={buildQuery(filters, { topic: undefined })}
        emptyLabel="Topics arrive with enrichment."
      />
      <FacetList
        title="Authors"
        facets={authors}
        activeValue={filters.author}
        hrefFor={(value) => buildQuery(filters, { author: value })}
        clearHref={buildQuery(filters, { author: undefined })}
      />
    </div>
  );

  return (
    <Shell counts={counts}>
      <div className="flex flex-col gap-8 lg:flex-row-reverse lg:items-start">
        <aside className="lg:sticky lg:top-6 lg:w-60 lg:shrink-0">
          <details className="lg:hidden" name="filters">
            <summary className="text-muted-foreground cursor-pointer text-sm font-medium">
              Filters
            </summary>
            <div className="mt-4">{sidebar}</div>
          </details>
          <div className="hidden lg:block">{sidebar}</div>
        </aside>

        <div className="min-w-0 flex-1">
          <form action="/" className="flex gap-2">
            <Input
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder="Search bookmark text and authors"
              aria-label="Search bookmarks"
            />
            {/* Filters survive a search; the search box is one more facet, not a reset. */}
            {filters.folder ? <input type="hidden" name="folder" value={filters.folder} /> : null}
            {filters.source ? <input type="hidden" name="source" value={filters.source} /> : null}
            {filters.topic ? <input type="hidden" name="topic" value={filters.topic} /> : null}
            {filters.author ? <input type="hidden" name="author" value={filters.author} /> : null}
            {filters.visibility ? (
              <input type="hidden" name="visibility" value={filters.visibility} />
            ) : null}
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          {activeFilters.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {activeFilters.map(([key, value]) => (
                <Link
                  key={key}
                  href={buildQuery(filters, { [key]: undefined })}
                  className="border-border text-muted-foreground hover:text-foreground rounded-full border px-2.5 py-1 transition-colors"
                >
                  {key}: <span className="text-foreground">{value}</span> ×
                </Link>
              ))}
              <Link href="/" className="text-muted-foreground hover:text-foreground underline">
                reset
              </Link>
            </div>
          ) : null}

          <p className="text-muted-foreground mt-6 text-xs">
            {bookmarks.length === 0
              ? "No matches"
              : `${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"}${
                  filters.q ? " by relevance" : " by newest first"
                }`}
          </p>

          {bookmarks.length === 0 ? (
            counts.bookmarks === 0 ? (
              <EmptyGraph />
            ) : (
              <p className="border-border text-muted-foreground mt-4 rounded-lg border border-dashed p-6 text-sm">
                Nothing matches these filters.{" "}
                <Link href="/" className="text-foreground underline">
                  Reset
                </Link>{" "}
                to see all {counts.bookmarks} bookmarks.
              </p>
            )
          ) : (
            <div className="mt-4 space-y-3">
              {bookmarks.map((bookmark) => (
                <BookmarkCard key={bookmark.xPostId} bookmark={bookmark} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  counts,
}: {
  children: React.ReactNode;
  counts?: { bookmarks: number; authors: number; topics: number; curated: number };
}) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="font-heading text-xl font-semibold tracking-tight">
            Bookmark Graph
          </Link>
          <p className="text-muted-foreground mt-1 text-sm">
            @alangnative&apos;s X bookmarks, in Neo4j. Private.
          </p>
        </div>
        {counts ? (
          <dl className="text-muted-foreground flex gap-5 text-xs">
            <Stat label="bookmarks" value={counts.bookmarks} />
            <Stat label="authors" value={counts.authors} />
            <Stat label="topics" value={counts.topics} />
            <Stat label="curated" value={counts.curated} />
          </dl>
        ) : null}
      </header>
      {children}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-foreground font-mono text-base tabular-nums">{value}</dd>
      <dd className="mt-0.5">{label}</dd>
    </div>
  );
}

function EmptyGraph() {
  return (
    <div className="border-border mt-4 rounded-lg border border-dashed p-6">
      <h2 className="font-heading text-base font-semibold">The graph is empty</h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        This repo never calls X. Bookmarks arrive through ingest — either the X Bookmarks agent
        posting to <code className="font-mono">/api/ingest</code>, or a local batch:
      </p>
      <pre className="bg-muted/60 mt-4 overflow-x-auto rounded-md p-3 font-mono text-xs">
        npm run ingest -- fixtures/demo-bookmarks.json
      </pre>
      <p className="text-muted-foreground mt-3 text-xs">
        That fixture is labeled demo data, not real captured bookmarks.
      </p>
    </div>
  );
}
