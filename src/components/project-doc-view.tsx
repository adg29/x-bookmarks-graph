import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { GraphUnreachable } from "@/components/graph-unreachable";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import {
  getOrCreateProjectDoc,
  getProjectDoc,
  listPublicProjectDocLinks,
  type ProjectDocSlug,
} from "@/lib/project-docs";
import { graphIsReachable } from "@/lib/queries";
import { isSignedIn } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function ProjectDocView({
  slug,
  saved,
}: {
  slug: ProjectDocSlug;
  saved?: boolean;
}) {
  const signedIn = await isSignedIn();

  const health = await graphIsReachable();
  if (!health.ok) {
    if (!signedIn) redirect(`/login?next=/${slug}`);
    return (
      <AppShell signedIn width="narrow">
        <GraphUnreachable error={health.error} />
      </AppShell>
    );
  }

  const doc = signedIn ? await getOrCreateProjectDoc(slug) : await getProjectDoc(slug);
  if (!doc || (!doc.isPublic && !signedIn)) {
    redirect(`/login?next=/${slug}`);
  }

  const publicDocs = signedIn ? undefined : await listPublicProjectDocLinks();

  return (
    <AppShell signedIn={signedIn} publicDocs={publicDocs} width="narrow">
      <article>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{doc.title}</h1>
            <Badge variant={doc.isPublic ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px] font-normal">
              {doc.isPublic ? "public" : "admin only"}
            </Badge>
          </div>
          {signedIn ? (
            <Link
              href={`/${slug}/edit`}
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              Edit
            </Link>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Updated {formatDate(doc.updatedAt)}
          {doc.isPublic
            ? ". Visible without signing in — bookmark data is not on this page."
            : ". Only signed-in admins can read this until it is marked public."}
        </p>
        {saved ? (
          <p className="border-border bg-muted/40 mt-4 rounded-lg border px-3 py-2 text-sm">
            Saved. The public toggle is live — no redeploy needed.
          </p>
        ) : null}
        <div className="mt-6">
          <Markdown source={doc.body} />
        </div>
      </article>
    </AppShell>
  );
}
