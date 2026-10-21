import { NextResponse } from "next/server";
import { adminClient, currentProfile } from "@/app/_lib/supabase";
import { issueSetupToken, setupPending, unusablePassword } from "@/app/_lib/setup-link";

/**
 * Adds a student to a class by email, as an alternative to the class link.
 *
 * Only the class's teacher or an administrator may do this; the check is
 * made here because the writes below use the service role.
 *
 *   - new email: creates a student account with no usable password, puts it
 *     in the class, and returns a one-time link for the student to choose
 *     their password (the teacher sends it on).
 *   - existing student: puts them in the class. If they never set their
 *     password, a fresh link is returned too.
 *   - a teacher's or administrator's email: refused.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role === "student") return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const fullName = String(body?.fullName ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
  }

  let admin;
  try {
    admin = adminClient();
  } catch {
    return NextResponse.json({ error: "The site is missing its service key, so students cannot be added yet." }, { status: 503 });
  }

  const { data: section } = await admin.from("sections").select("id, teacher_id").eq("id", params.id).maybeSingle();
  if (!section) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (section.teacher_id !== profile.id && profile.role !== "admin") {
    return NextResponse.json({ error: "Only this class's teacher or an administrator can add students to it." }, { status: 403 });
  }

  const origin = new URL(request.url).origin;
  const linkFor = (token: string) => `${origin}/welcome/${token}`;

  const enrol = async (studentId: string) => {
    const { data: already } = await admin
      .from("enrolments")
      .select("student_id, status")
      .eq("section_id", section.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (already) {
      if (already.status !== "active") {
        const { error } = await admin
          .from("enrolments")
          .update({ status: "active" })
          .eq("section_id", section.id)
          .eq("student_id", studentId);
        if (error) throw error;
      }
      return already.status === "active" ? "already" : "added";
    }
    const { error } = await admin.from("enrolments").insert({ section_id: section.id, student_id: studentId, status: "active" });
    if (error) throw error;
    return "added";
  };

  // an existing account
  const { data: existing } = await admin.from("profiles").select("id, full_name, role, active").eq("email", email).maybeSingle();
  if (existing) {
    if (existing.role !== "student") {
      const kind = existing.role === "admin" ? "an administrator" : "a teacher";
      return NextResponse.json({ error: `${email} belongs to ${kind} account, not a student.` }, { status: 409 });
    }
    try {
      if (!existing.active) await admin.from("profiles").update({ active: true }).eq("id", existing.id);
      const result = await enrol(existing.id);
      const { data: u } = await admin.auth.admin.getUserById(existing.id);
      const pending = setupPending(u?.user?.app_metadata);
      return NextResponse.json({
        ok: true,
        name: existing.full_name,
        email,
        status: result, // "added" | "already"
        newAccount: false,
        link: pending ? linkFor(await issueSetupToken(existing.id)) : null,
      });
    } catch (e) {
      console.error("add student: existing", e);
      return NextResponse.json({ error: "The student could not be added. Please try again." }, { status: 500 });
    }
  }

  // a new account
  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json({ error: "Give the student's full name (it is a new account)." }, { status: 400 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: unusablePassword(),
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created?.user) {
    console.error("add student: create user", createError);
    const already = /already|exists|registered/i.test(createError?.message ?? "");
    return NextResponse.json(
      { error: already ? "An account with that email already exists but has no profile. Ask the academy owner to check it." : "The account could not be created. Please try again." },
      { status: already ? 409 : 500 }
    );
  }

  const userId = created.user.id;
  try {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ full_name: fullName, role: "student", active: true })
      .eq("id", userId);
    if (profileError) console.error("add student: profile update", profileError);
    await enrol(userId);
    const token = await issueSetupToken(userId);
    return NextResponse.json({ ok: true, name: fullName, email, status: "added", newAccount: true, link: linkFor(token) });
  } catch (e) {
    console.error("add student: enrol or link", e);
    return NextResponse.json(
      { error: "The account was created but could not be finished. Add the same email again to retry." },
      { status: 500 }
    );
  }
}
