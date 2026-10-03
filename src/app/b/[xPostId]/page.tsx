import Link from "next/link";
import { notFound } from "next/navigation";

import { BookmarkCard } from "@/components/bookmark-card";
import { GraphUnreachable } from "@/components/graph-unreachable";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCount, formatDate, metricLabel } from "@/lib/format";
import { getBookmark, getRelated, getTopicNeighbours, graphIsReachable } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BookmarkPage({ params }: PageProps<"/b/[xPostId]">) {
  const { xPostId } = await params;

  const health = await graphIsReachable();
  if (!health.ok) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <GraphUnreachable error={health.error} />
      </main>
    );
  }

  const bookmark = await getBookmark(xPostId);
  if (!bookmark) notFound();

  const [related, neighbours] = await Promise.all([
    getRelated(xPostId),
    getTopicNeighbours(xPostId),
  ]);

  const metrics = Object.entries(bookmark.publicMetrics ?? {})
    .map(([key, value]) => ({ label: metricLabel(key), value: formatCount(value) }))
    .filter((metric) => metric.value !== null);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
        ← All bookmarks
      </Link>

      <article className="mt-6">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Link
            href={`/?author=${encodeURIComponent(bookmark.authorHandle)}`}
            className="text-foreground font-medium hover:underline"
          >
            @{bookmark.authorHandle}
          </Link>
          <span aria-hidden>·</span>
          <time dateTime={bookmark.createdAt}>{formatDate(bookmark.createdAt)}</time>
          {bookmark.folder ? (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/?folder=${encodeURIComponent(bookmark.folder)}`}
                className="font-mono hover:underline"
              >
                {bookmark.folder}
              </Link>
            </>
          ) : null}
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
            {bookmark.source}
          </Badge>
          <Badge
            variant={bookmark.visibility === "curated" ? "secondary" : "outline"}
            className="h-5 px-1.5 text-[10px] font-normal"
          >
            {bookmark.visibility}
          </Badge>
        </div>

        <p className="mt-4 text-base leading-relaxed whitespace-pre-wrap">
          {bookmark.text || <span className="text-muted-foreground italic">No text captured</span>}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm underline underline-offset-4"
          >
            Open on X
          </a>
          {metrics.length > 0 ? (
            <dl className="text-muted-foreground flex flex-wrap gap-4 text-xs">
              {metrics.map((metric) => (
                <div key={metric.label} className="flex gap-1">
                  <dd className="text-foreground font-mono tabular-nums">{metric.value}</dd>
                  <dt>{metric.label}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {bookmark.topics.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {bookmark.topics.map((topic) => (
              <Link
                key={topic}
                href={`/?topic=${encodeURIComponent(topic)}`}
                className="text-muted-foreground hover:text-foreground border-border rounded-full border px-2.5 py-0.5 text-xs transition-colors"
              >
                {topic}
              </Link>
            ))}
          </div>
        ) : null}
      </article>

      <Separator className="my-8" />

      <Section
        title="Related"
        caption="RELATED_TO edges asserted at ingest."
        empty="No related bookmarks have been linked yet."
      >
        {related.map((item) => (
          <BookmarkCard key={item.xPostId} bookmark={item} />
        ))}
      </Section>

      <Section
        title="Same topics"
        caption="Reached by walking ABOUT edges through shared topics."
        empty="No other bookmark shares a topic with this one yet."
      >
        {neighbours.map((item) => (
          <BookmarkCard key={item.xPostId} bookmark={item} shared={item.shared} />
        ))}
      </Section>

      <dl className="text-muted-foreground mt-10 grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
        <Meta label="xPostId" value={bookmark.xPostId} />
        <Meta label="conversationId" value={bookmark.conversationId ?? "—"} />
        <Meta label="ingested" value={formatDate(bookmark.ingestedAt)} />
        <Meta label="updated" value={formatDate(bookmark.updatedAt)} />
      </dl>
    </main>
  );
}

function Section({
  title,
  caption,
  empty,
  children,
}: {
  title: string;
  caption: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">{title}</h2>
      <p className="text-muted-foreground mt-1 text-xs">{caption}</p>
      {children.length === 0 ? (
        <p className="border-border text-muted-foreground mt-3 rounded-lg border border-dashed p-4 text-sm">
          {empty}
        </p>
      ) : (
        <div className="mt-3 space-y-3">{children}</div>
      )}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0">{label}</dt>
      <dd className="text-foreground truncate font-mono">{value}</dd>
    </div>
  );
}
