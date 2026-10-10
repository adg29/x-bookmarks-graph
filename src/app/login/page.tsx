import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SESSION_COOKIE, isGateConfigured, passphraseMatches, sessionToken } from "@/lib/auth";
import { listPublicProjectDocLinks } from "@/lib/project-docs";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Bookmark Graph" };

async function signIn(formData: FormData) {
  "use server";

  const passphrase = String(formData.get("passphrase") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!(await passphraseMatches(passphrase))) {
    redirect(`/login?error=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  const token = await sessionToken();
  if (!token) redirect("/login?error=unconfigured");

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect(next.startsWith("/") ? next : "/");
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const error = typeof params.error === "string" ? params.error : null;
  const configured = isGateConfigured();
  const publicDocs = await listPublicProjectDocLinks();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Bookmark Graph</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Private knowledge graph for @alangnative&apos;s X bookmarks.
      </p>

      {configured ? (
        <form action={signIn} className="mt-8 space-y-3">
          <input type="hidden" name="next" value={next} />
          <Input
            name="passphrase"
            type="password"
            autoComplete="current-password"
            placeholder="Access passphrase"
            aria-label="Access passphrase"
            autoFocus
            required
          />
          {error === "1" ? (
            <p className="text-destructive text-sm">That passphrase did not match.</p>
          ) : null}
          <Button type="submit" className="w-full">
            Open the graph
          </Button>
          <p className="text-muted-foreground pt-2 text-xs leading-relaxed">
            v1 uses a single shared passphrase (<code className="font-mono">APP_ACCESS_SECRET</code>
            ). See the README for swapping in a real auth provider.
          </p>
        </form>
      ) : (
        <div className="border-destructive/40 bg-destructive/10 mt-8 rounded-lg border p-4 text-sm">
          <p className="font-medium">The gate is not configured.</p>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            <code className="font-mono">APP_ACCESS_SECRET</code> is unset in a production build, so
            the explorer stays locked. Set it in your Vercel project environment and redeploy.
          </p>
        </div>
      )}

      {publicDocs.length > 0 ? (
        <p className="text-muted-foreground mt-10 text-center text-xs">
          {publicDocs.map((doc, index) => (
            <span key={doc.slug}>
              {index > 0 ? <span aria-hidden> · </span> : null}
              <Link href={`/${doc.slug}`} className="hover:text-foreground underline-offset-4 hover:underline">
                {doc.title}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </main>
  );
}
