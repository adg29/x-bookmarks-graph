import { AppShell } from "@/components/app-shell";
import { GraphUnreachable } from "@/components/graph-unreachable";
import { Button } from "@/components/ui/button";
import { saveProjectDoc } from "@/app/project-doc-actions";
import { getOrCreateProjectDoc, type ProjectDocSlug } from "@/lib/project-docs";
import { graphIsReachable } from "@/lib/queries";
import { requireSignedIn } from "@/lib/session";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function ProjectDocEditor({
  slug,
  error,
}: {
  slug: ProjectDocSlug;
  error?: string | null;
}) {
  await requireSignedIn(`/${slug}/edit`);

  const health = await graphIsReachable();
  if (!health.ok) {
    return (
      <AppShell signedIn width="narrow">
        <GraphUnreachable error={health.error} />
      </AppShell>
    );
  }

  const doc = await getOrCreateProjectDoc(slug);

  return (
    <AppShell signedIn width="narrow">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit {doc.title}</h1>
        <Link
          href={`/${slug}`}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to {doc.title}
        </Link>
      </div>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Markdown is stored on a <code className="font-mono">ProjectDoc</code> node. The public
        toggle is read on the next request — guests never see bookmark routes from here.
      </p>
      {error === "too-large" ? (
        <p className="text-destructive mt-4 text-sm">Body is over 100,000 characters.</p>
      ) : null}

      <form action={saveProjectDoc.bind(null, slug)} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Markdown
          </span>
          <textarea
            name="body"
            defaultValue={doc.body}
            rows={22}
            required
            className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 mt-1.5 w-full resize-y rounded-lg border px-3 py-2 font-mono text-sm leading-relaxed outline-none focus-visible:ring-3 dark:bg-input/30"
          />
        </label>

        <label className="border-border flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            name="isPublic"
            defaultChecked={doc.isPublic}
            className="mt-1 size-4 accent-foreground"
          />
          <span>
            <span className="font-medium">Public</span>
            <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
              Unauthenticated visitors can read <code className="font-mono">/{slug}</code>. Off by
              default. Bookmark pages and APIs stay behind the login gate either way.
            </span>
          </span>
        </label>

        <Button type="submit">Save</Button>
      </form>
    </AppShell>
  );
}
