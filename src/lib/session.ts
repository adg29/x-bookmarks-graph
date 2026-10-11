import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, isValidSession } from "./auth";

/** Pages that need to know who is signed in go through here — not `auth.ts` — so proxy stays free of `next/headers`. */
export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  return isValidSession(store.get(SESSION_COOKIE)?.value);
}

export async function requireSignedIn(next = "/"): Promise<void> {
  if (await isSignedIn()) return;
  const suffix = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  redirect(`/login${suffix}`);
}
