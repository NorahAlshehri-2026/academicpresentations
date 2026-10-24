import { NextResponse } from "next/server";
import { adminClient, serverClient } from "@/app/_lib/supabase";
import { termsRecord } from "@/app/_lib/terms";

/**
 * Records that the signed-in person has accepted the current terms of use.
 * Stored in app_metadata, which only the server can write, so a student
 * cannot mark the terms as accepted without going through this.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body?.agreed !== true) {
    return NextResponse.json({ error: "Tick the box to accept the terms of use." }, { status: 400 });
  }

  const {
    data: { user },
  } = await serverClient().auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let admin;
  try {
    admin = adminClient();
  } catch {
    return NextResponse.json({ error: "Your answer could not be saved just now. Please tell your teacher." }, { status: 503 });
  }

  // app_metadata keys are merged, so this leaves everything else in place
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { terms: termsRecord() } });
  if (error) {
    console.error("agreement: save", error);
    return NextResponse.json({ error: "Your answer could not be saved. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
