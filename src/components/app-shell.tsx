import Link from "next/link";

import type { ProjectDocSlug } from "@/lib/project-docs";
import { PROJECT_DOC_SLUGS, PROJECT_DOC_TITLES } from "@/lib/project-docs";

export function AppShell({
  children,
  signedIn,
  counts,
  publicDocs,
  width = "wide",
}: {
  children: React.ReactNode;
  signedIn: boolean;
  counts?: { bookmarks: number; authors: number; topics: number; curated: number };
  publicDocs?: { slug: ProjectDocSlug; title: string }[];
  width?: "wide" | "narrow";
}) {
  const guestDocs = publicDocs ?? [];

  return (
    <main
      className={`mx-auto w-full flex-1 px-6 py-8 ${width === "wide" ? "max-w-5xl" : "max-w-3xl"}`}
    >
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={signedIn ? "/" : "/login"}
            className="font-heading text-xl font-semibold tracking-tight"
          >
            Bookmark Graph
          </Link>
          <p className="text-muted-foreground mt-1 text-sm">
            {signedIn
              ? "@alangnative\u2019s X bookmarks, in Neo4j. Private."
              : "Project notes. The bookmark graph stays private."}
          </p>
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {signedIn ? (
              <>
                <NavLink href="/">Bookmarks</NavLink>
                {PROJECT_DOC_SLUGS.map((slug) => (
                  <NavLink key={slug} href={`/${slug}`}>
                    {PROJECT_DOC_TITLES[slug]}
                  </NavLink>
                ))}
              </>
            ) : (
              <>
                {guestDocs.map((doc) => (
                  <NavLink key={doc.slug} href={`/${doc.slug}`}>
                    {doc.title}
                  </NavLink>
                ))}
                <NavLink href="/login">Sign in</NavLink>
              </>
            )}
          </nav>
        </div>
        {signedIn && counts ? (
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
      {children}
    </Link>
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
