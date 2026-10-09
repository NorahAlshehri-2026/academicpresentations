import { NextResponse } from "next/server";
import { adminClient, currentProfile } from "@/app/_lib/supabase";

/**
 * Redeems a one-time staff invitation link.
 *
 * The link is the only thing that can make someone a teacher or an
 * administrator, apart from the academy owner changing a role directly. The
 * role comes from the invitation row, never from the request, and the row is
 * claimed before anything is created, so a link cannot be used twice even if
 * it is opened in two places at once.
 *
 * Two cases:
 *   - not signed in: creates the account (name, email, password) with the role
 *   - signed in: raises that account's role; it never lowers one
 */

const MIN_PASSWORD = 8;
const RANK: Record<string, number> = { student: 0, teacher: 1, admin: 2 };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "").trim();
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: "That invitation link is not valid." }, { status: 400 });
  }

  let admin;
  try {
    admin = adminClient();
  } catch {
    return NextResponse.json(
      { error: "Accounts cannot be created yet because the site is missing its service key." },
      { status: 503 }
    );
  }

  const profile = await currentProfile().catch(() => null);

  // validate the form before claiming the link, so a typo does not use it up
  let fullName = "";
  let email = "";
  let password = "";
  if (!profile) {
    fullName = String(body?.fullName ?? "").trim();
    email = String(body?.email ?? "").trim().toLowerCase();
    password = String(body?.password ?? "");
    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json({ error: "Please give your full name." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `Please choose a password of at least ${MIN_PASSWORD} characters.` }, { status: 400 });
    }
    const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "You already have an account with that email. Sign in, then open this link again.", signIn: true },
        { status: 409 }
      );
    }
  }

  // claim the link: only one request can win this
  const { data: claimed } = await admin
    .from("staff_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .is("used_by", null)
    .eq("revoked", false)
    .select("token, role")
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json(
      { error: "This invitation link has already been used or was cancelled. Ask for a new one." },
      { status: 410 }
    );
  }

  const release = () => admin.from("staff_invites").update({ used_at: null }).eq("token", token).is("used_by", null);
  const role = claimed.role as "teacher" | "admin";

  // signed in already: raise the role, never lower it
  if (profile) {
    const raise = RANK[role] > RANK[profile.role];
    if (raise) {
      const { error } = await admin.from("profiles").update({ role }).eq("id", profile.id);
      if (error) {
        await release();
        console.error("staff-join: role update", error);
        return NextResponse.json({ error: "Your account could not be updated. Please try again." }, { status: 500 });
      }
    }
    await admin.from("staff_invites").update({ used_by: profile.id }).eq("token", token);
    return NextResponse.json({ ok: true, role: raise ? role : profile.role });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // the link is the invitation; no confirmation email
    user_metadata: { full_name: fullName },
  });

  if (createError || !created?.user) {
    await release();
    console.error("staff-join: create user", createError);
    const already = /already|exists|registered/i.test(createError?.message ?? "");
    return NextResponse.json(
      {
        error: already
          ? "You already have an account with that email. Sign in, then open this link again."
          : "The account could not be created. Please try again.",
        signIn: already,
      },
      { status: already ? 409 : 500 }
    );
  }

  const userId = created.user.id;
  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, role, active: true })
    .eq("id", userId);
  if (profileError) console.error("staff-join: profile update", profileError);

  await admin.from("staff_invites").update({ used_by: userId }).eq("token", token);

  return NextResponse.json({ ok: true, role });
}
