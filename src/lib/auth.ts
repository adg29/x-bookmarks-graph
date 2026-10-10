import { accessSecret } from "./env";

/**
 * v1 gate: one shared passphrase, one signed-ish cookie. The explorer is private by
 * default — an unset APP_ACCESS_SECRET in production locks everyone out rather than
 * letting everyone in.
 *
 * Swapping in a real provider (NextAuth, Clerk, Auth0) means replacing this module and
 * `src/proxy.ts`. Pages read the session only through `src/lib/session.ts`.
 */

export const SESSION_COOKIE = "bkg_session";

/** Web Crypto so the same code runs in middleware (edge) and in server components (node). */
async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sessionToken(): Promise<string | null> {
  const secret = accessSecret();
  if (!secret) return null;
  return sha256(`bkg:v1:${secret}`);
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await sessionToken();
  if (!expected) return false;
  return timingSafeEqual(cookieValue, expected);
}

export async function passphraseMatches(submitted: string): Promise<boolean> {
  const secret = accessSecret();
  if (!secret) return false;
  return timingSafeEqual(submitted.trim(), secret);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function isGateConfigured(): boolean {
  return accessSecret() !== null;
}
