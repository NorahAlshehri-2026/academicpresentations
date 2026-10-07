import { NextResponse } from "next/server";
import { currentProfile, adminClient } from "@/app/_lib/supabase";

/**
 * Invites someone by email. Admin only.
 *
 * Creating a user and setting a role both need the service role, so this runs
 * on the server. The caller's own role is checked first, through their own
 * session — an ordinary user calling this endpoint directly gets a 403.
 */
export async function POST(request: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can invite people." }, { status: 403 });
  }

  const { email, fullName, role } = await request.json().catch(() => ({}));

  if (!email || !fullName) {
    return NextResponse.json({ error: "A name and an email are both needed." }, { status: 400 });
  }
  if (!["student", "teacher", "admin"].includes(role)) {
    return NextResponse.json({ error: "That is not a role." }, { status: 400 });
  }

  const admin = adminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${site}/login`,
  });

  if (error) {
    const already = error.message.toLowerCase().includes("already");
    return NextResponse.json(
      {
        error: already
          ? "That email already has an account."
          : `The invitation could not be sent: ${error.message}`,
      },
      { status: already ? 409 : 502 }
    );
  }

  // the trigger created a student profile; set the real name and role
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role, full_name: fullName })
    .eq("id", data.user.id);

  if (roleError) {
    return NextResponse.json(
      { error: `Invited, but the role could not be set: ${roleError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
