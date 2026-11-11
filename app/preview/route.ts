import { NextResponse } from "next/server";
import { currentProfile } from "@/app/_lib/supabase";
import { PREVIEW_COOKIE, PREVIEW_MAX_AGE, previewTarget, safeNext } from "@/app/_lib/preview-cookie";

export const dynamic = "force-dynamic";

/**
 * Student preview on and off, for teachers and administrators.
 *   /preview?to=on&next=/units    see the site as a student, starting at /units
 *   /preview?to=off&next=/units   back to the staff view of the same page
 * Students and signed-out visitors are sent on without a change.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const on = url.searchParams.get("to") !== "off";
  const next = safeNext(url.searchParams.get("next"));

  let profile = null;
  try {
    profile = await currentProfile();
  } catch {}

  if (!profile) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin), { status: 303 });

  const staff = profile.role !== "student";
  const res = NextResponse.redirect(new URL(on && staff ? previewTarget(next) : next, url.origin), { status: 303 });
  res.headers.set("Cache-Control", "no-store");

  if (on && staff) {
    res.cookies.set(PREVIEW_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: PREVIEW_MAX_AGE,
    });
  } else {
    res.cookies.set(PREVIEW_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return res;
}
