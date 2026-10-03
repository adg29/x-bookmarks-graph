import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { BookmarkSummary } from "@/lib/queries";
import { formatRelative } from "@/lib/format";

export function BookmarkCard({
  bookmark,
  shared,
}: {
  bookmark: BookmarkSummary;
  /** Topic names that connect this bookmark to the one being viewed. */
  shared?: string[];
}) {
  return (
    <article className="border-border hover:border-foreground/25 group relative rounded-lg border p-4 transition-colors">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="text-foreground font-medium">@{bookmark.authorHandle}</span>
        <span aria-hidden>·</span>
        <time dateTime={bookmark.createdAt}>{formatRelative(bookmark.createdAt)}</time>
        {bookmark.folder ? (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono">{bookmark.folder}</span>
          </>
        ) : null}
        {bookmark.source === "grok-from-x" ? (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
            grok
          </Badge>
        ) : null}
        {bookmark.visibility === "curated" ? (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
            curated
          </Badge>
        ) : null}
      </div>

      <Link href={`/b/${bookmark.xPostId}`} className="mt-2 block">
        <span className="absolute inset-0" aria-hidden />
        <p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap">
          {bookmark.text || <span className="text-muted-foreground italic">No text captured</span>}
        </p>
      </Link>

      {shared && shared.length > 0 ? (
        <p className="text-muted-foreground mt-3 text-xs">
          shares <span className="text-foreground">{shared.join(", ")}</span>
        </p>
      ) : bookmark.topics.length > 0 ? (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {bookmark.topics.slice(0, 6).map((topic) => (
            <Link
              key={topic}
              href={`/?topic=${encodeURIComponent(topic)}`}
              className="text-muted-foreground hover:text-foreground border-border rounded-full border px-2 py-0.5 text-[11px] transition-colors"
            >
              {topic}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
