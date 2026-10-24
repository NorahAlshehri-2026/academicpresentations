import { NextResponse } from "next/server";
import { adminClient } from "@/app/_lib/supabase";
import { checkSetupToken } from "@/app/_lib/setup-link";
import { termsRecord } from "@/app/_lib/terms";

const MIN_PASSWORD = 8;

/**
 * Redeems a one-time "set your password" link (see setup-link.ts): sets the
 * password and clears the link, so it cannot be used again. Returns the
 * email so the page can sign the student straight in.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (body?.agreed !== true) {
    return NextResponse.json({ error: "Tick the box to accept the terms of use." }, { status: 400 });
  }

  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `Please choose a password of at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }

  let check;
  try {
    check = await checkSetupToken(token);
  } catch {
    return NextResponse.json({ error: "The link could not be checked just now. Please try again." }, { status: 502 });
  }
  if (!check.ok) {
    const msg =
      check.reason === "used"
        ? "This link has already been used. Sign in with your email and password."
        : check.reason === "expired"
          ? "This link has expired. Ask your teacher for a new one."
          : "This link is not valid. Ask your teacher for a new one.";
    return NextResponse.json({ error: msg, signIn: check.reason === "used" }, { status: 410 });
  }

  const { error } = await adminClient().auth.admin.updateUserById(check.user.id, {
    password,
    app_metadata: { setup: null, terms: termsRecord() }, // terms accepted on the form
  });
  if (error) {
    console.error("welcome: set password", error);
    return NextResponse.json({ error: "Your password could not be saved. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: check.user.email });
}
