import Link from "next/link";

import type { Facet } from "@/lib/queries";

export function FacetList({
  title,
  facets,
  activeValue,
  hrefFor,
  clearHref,
  emptyLabel,
}: {
  title: string;
  facets: Facet[];
  activeValue?: string;
  hrefFor: (value: string) => string;
  clearHref: string;
  emptyLabel?: string;
}) {
  if (facets.length === 0) {
    return emptyLabel ? (
      <section>
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </h3>
        <p className="text-muted-foreground mt-2 text-xs">{emptyLabel}</p>
      </section>
    ) : null;
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </h3>
        {activeValue ? (
          <Link href={clearHref} className="text-muted-foreground hover:text-foreground text-xs">
            clear
          </Link>
        ) : null}
      </div>
      <ul className="mt-2 space-y-0.5">
        {facets.map((facet) => {
          const active = facet.value === activeValue;
          return (
            <li key={facet.value}>
              <Link
                href={active ? clearHref : hrefFor(facet.value)}
                className={[
                  "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                ].join(" ")}
              >
                <span className="truncate">{facet.value}</span>
                <span className="font-mono text-xs tabular-nums opacity-60">{facet.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
