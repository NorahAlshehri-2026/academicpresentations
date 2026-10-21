import Link from "next/link";
import { adminClient } from "@/app/_lib/supabase";
import { checkSetupToken } from "@/app/_lib/setup-link";
import WelcomeForm from "@/app/_components/WelcomeForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome · Academic Presentations" };

const card = { maxWidth: 520, margin: "40px auto" } as const;

/**
 * The one-time link a teacher sends to a student they added by email. Like a
 * class link it works without signing in; it shows only the student's own
 * name, email and classes.
 */
export default async function WelcomePage({ params }: { params: { token: string } }) {
  let check: Awaited<ReturnType<typeof checkSetupToken>>;
  try {
    check = await checkSetupToken(decodeURIComponent(params.token));
  } catch {
    return (
      <div className="card" style={card}>
        <h3>This link cannot be checked right now</h3>
        <p className="small muted">Please try again in a moment, or tell your teacher.</p>
      </div>
    );
  }

  if (!check.ok) {
    return (
      <div className="card" style={card}>
        <h3>
          {check.reason === "used" ? "This link has already been used" : check.reason === "expired" ? "This link has expired" : "This link does not work"}
        </h3>
        <p className="small muted">
          {check.reason === "used"
            ? "Your password is already set. Sign in with your email and password."
            : "Ask your teacher to add you again: they will get a new link to send you."}
        </p>
        <Link className="btn gold block" style={{ marginTop: 12 }} href="/login?next=/activities">Sign in</Link>
      </div>
    );
  }

  const user = check.user;
  const { data: profile } = await adminClient().from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const { data: classes } = await adminClient()
    .from("enrolments")
    .select("section:sections(number, term, courses(title))")
    .eq("student_id", user.id)
    .eq("status", "active");
  const first = ((classes ?? []) as any[]).map((c) => c.section).filter(Boolean)[0];

  return (
    <div className="card" style={card}>
      <span className="pill">You have been added to a class</span>
      <h3 style={{ marginTop: 10 }}>Welcome, {(profile as any)?.full_name ?? "student"}</h3>
      {first && (
        <p className="small muted">
          {first.courses?.title} · Section {first.number} · {first.term}
        </p>
      )}
      <div className="note" style={{ margin: "14px 0" }}>
        Your teacher has set up your account. Choose a password to finish, and you will be taken straight into the course.
      </div>
      <WelcomeForm token={decodeURIComponent(params.token)} email={user.email ?? ""} />
    </div>
  );
}
