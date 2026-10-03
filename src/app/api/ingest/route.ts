import { NextResponse, type NextRequest } from "next/server";

import { ingestToken } from "@/lib/env";
import { ingestBookmarks } from "@/lib/ingest";

/**
 * The ingest surface for the X Bookmarks agent.
 *
 *   POST /api/ingest
 *   Authorization: Bearer $INGEST_TOKEN
 *   { "bookmarks": [ { ...contract... } ] }
 *
 * Idempotent: re-posting the same batch changes nothing. See CONTEXT.md for the field
 * contract and README.md for a copy-pasteable example.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  let expected: string;
  try {
    expected = ingestToken();
  } catch {
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (presented.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Send Authorization: Bearer <INGEST_TOKEN>." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  try {
    const result = await ingestBookmarks(payload);

    // Nothing usable in the batch is a client error; partial failures are not.
    const status = result.received === 0 && result.errors.length > 0 ? 400 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ingest] failed:", message);
    return NextResponse.json({ error: "Ingest failed.", detail: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Use POST.",
      contract: {
        required: ["xPostId", "url", "text", "authorHandle", "createdAt"],
        optional: ["conversationId", "folder", "publicMetrics", "source", "topics", "relatedTo"],
        source: ["x", "grok-from-x"],
        visibility: "always 'private' on ingest; only the allowlist action sets 'curated'",
      },
    },
    { status: 405 },
  );
}
