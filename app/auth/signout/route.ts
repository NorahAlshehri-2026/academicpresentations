import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = serverClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
