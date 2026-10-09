import { NextResponse } from "next/server";

/**
 * Emailed invitations have been replaced by one-time invitation links, which
 * only the academy owner can make (Admin page). This endpoint is kept so that
 * an old bookmark or script gets a clear answer instead of a missing page.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Email invitations are no longer used. The academy owner makes one-time links on the Admin page." },
    { status: 410 }
  );
}
