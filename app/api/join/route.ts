import { NextResponse } from "next/server";
import { adminClient } from "@/app/_lib/supabase";

/**
 * Creates a student account from a class link and enrols it in that section.
 *
 * This is the only way an account is created without an emailed invitation, so
 * the class code is the gate, and it is checked here on the server before
 * anything is written. Three things are deliberately not taken from the form:
 *
 *   - the role, which is always 'student'. A request that asks to be a teacher
 *     is ignored rather than refused, because the field is never read.
 *   - the section, which comes from the code, not from the request body.
 *   - whether enrolment is open, which comes from the section row.
 *
 * ALLOWED_EMAIL_DOMAINS, if set, restricts who may use a link that has been
 * forwarded beyond the class.
 */

const MIN_PASSWORD = 8;

function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const fullName = String(body?.fullName ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!code) {
    return NextResponse.json({ error: "That link is missing its class code." }, { status: 400 });
  }
  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json({ error: "Please give your full name." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Please choose a password of at least ${MIN_PASSWORD} characters.` },
      { status: 400 }
    );
  }

  const domains = allowedDomains();
  if (domains.length && !domains.includes(email.split("@")[1])) {
    return NextResponse.json(
      {
        error:
          domains.length === 1
            ? `This class is open to @${domains[0]} addresses only.`
            : `This class is open to these addresses only: ${domains.map((d) => "@" + d).join(", ")}.`,
      },
      { status: 403 }
    );
  }

  let admin;
  try {
    admin = adminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Accounts cannot be created yet because the site is missing its service key. " +
          "Please tell your teacher.",
      },
      { status: 503 }
    );
  }

  // the code decides the section, not the request
  const { data: section, error: sectionError } = await admin
    .from("sections")
    .select("id, number, term, invites_open, course_id, courses(title)")
    .eq("invite_code", code)
    .maybeSingle();

  if (sectionError) {
    console.error("join: section lookup", sectionError);
    return NextResponse.json(
      { error: "The class could not be checked just now. Please try again in a moment." },
      { status: 502 }
    );
  }
  if (!section) {
    return NextResponse.json(
      { error: "That link does not match any class. Ask your teacher for a current one." },
      { status: 404 }
    );
  }
  if (!section.invites_open) {
    return NextResponse.json(
      { error: "This class is closed to new students. Ask your teacher to reopen it." },
      { status: 403 }
    );
  }

  // an existing account signs in instead; this route never touches one
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: "You already have an account with that email. Sign in, then open this link again.",
        signIn: true,
      },
      { status: 409 }
    );
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // the class link is the invitation; no confirmation email
    user_metadata: { full_name: fullName },
  });

  if (createError || !created?.user) {
    console.error("join: create user", createError);
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

  // The database trigger creates the profile as a student. Make the name and
  // the role certain rather than assumed.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, role: "student", active: true })
    .eq("id", userId);

  if (profileError) console.error("join: profile update", profileError);

  const { error: enrolError } = await admin
    .from("enrolments")
    .insert({ section_id: section.id, student_id: userId, status: "active" });

  if (enrolError) {
    console.error("join: enrol", enrolError);
    return NextResponse.json(
      {
        error:
          "Your account was created but joining the class failed. Sign in and open the link again.",
        signIn: true,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    courseId: section.course_id,
    courseTitle: (section as any).courses?.title ?? null,
    section: `${section.number} · ${section.term}`,
  });
}
