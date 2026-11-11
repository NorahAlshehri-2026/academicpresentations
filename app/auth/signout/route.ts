import { NextResponse } from "next/server";
import { serverClient } from "@/app/_lib/supabase";
import { PREVIEW_COOKIE } from "@/app/_lib/preview-cookie";

export async function POST(request: Request) {
  const supabase = serverClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  // signing out also ends a student preview
  res.cookies.set(PREVIEW_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
