import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient, adminClient } from "@/app/_lib/supabase";
import JoinButton from "@/app/_components/JoinButton";
import JoinSignup from "@/app/_components/JoinSignup";

/**
 * A class link, shareable in an announcement or a WhatsApp message.
 *
 * It has to work for a student who has never been here, so this page does not
 * require a signed-in account. The code is looked up with the service role,
 * because the sections table is closed to visitors who are not signed in; the
 * page then shows only the course title, the section and the term, and nothing
 * about anyone enrolled.
 */

const card = { maxWidth: 520, margin: "40px auto" } as const;

export default async function JoinPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const profile = await currentProfile();

  type Section = {
    id: string;
    number: string;
    term: string;
    invites_open: boolean;
    course_id: string;
    courses: { id: string; title: string; summary: string | null } | null;
  };

  let section: Section | null = null;
  let lookupFailed = false;

  if (profile) {
    const supabase = serverClient();
    const { data } = await supabase
      .from("sections")
      .select("id, number, term, invites_open, course_id, courses(id, title, summary)")
      .eq("invite_code", code)
      .maybeSingle();
    section = (data as any) ?? null;
  } else {
    try {
      const { data, error } = await adminClient()
        .from("sections")
        .select("id, number, term, invites_open, course_id, courses(id, title, summary)")
        .eq("invite_code", code)
        .maybeSingle();
      if (error) throw error;
      section = (data as any) ?? null;
    } catch {
      lookupFailed = true;
    }
  }

  if (lookupFailed) {
    return (
      <div className="card" style={card}>
        <h3>This link cannot be checked right now</h3>
        <p className="small muted">
          The site is missing the key it needs to create accounts. Please tell your teacher, and try
          the link again later.
        </p>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="card" style={card}>
        <h3>That join link does not work</h3>
        <p className="small muted">
          The code does not match any class. Ask your teacher for a current link.
        </p>
      </div>
    );
  }

  const course = section.courses;

  if (!section.invites_open) {
    return (
      <div className="card" style={card}>
        <h3>This class is closed to new students</h3>
        <p className="small muted">
          {course?.title} · section {section.number}. Ask your teacher to reopen it.
        </p>
      </div>
    );
  }

  // already signed in: just enrol
  if (profile) {
    const supabase = serverClient();
    const { data: already } = await supabase
      .from("enrolments")
      .select("id")
      .eq("section_id", section.id)
      .eq("student_id", profile.id)
      .maybeSingle();

    if (already) redirect(`/learn/${section.course_id}`);

    return (
      <div className="card" style={card}>
        <span className="pill">Joining a class</span>
        <h3 style={{ marginTop: 10 }}>{course?.title}</h3>
        <p className="small muted">{course?.summary}</p>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Section {section.number} · {section.term}
        </p>
        <p className="small" style={{ marginTop: 10 }}>
          Signed in as <b>{profile.full_name}</b>.
        </p>
        <JoinButton
          sectionId={section.id}
          studentId={profile.id}
          courseId={section.course_id}
        />
      </div>
    );
  }

  // not signed in: create the account and join in one step
  return (
    <div className="card" style={card}>
      <span className="pill">You have been invited</span>
      <h3 style={{ marginTop: 10 }}>{course?.title}</h3>
      <p className="small muted">{course?.summary}</p>
      <p className="tiny muted" style={{ marginTop: 10 }}>
        Section {section.number} · {section.term}
      </p>

      <div className="note" style={{ margin: "14px 0" }}>
        Set up your account below. It takes a moment, and you will be taken straight into the
        course.
      </div>

      <JoinSignup code={code} />

      <p className="tiny muted center" style={{ marginTop: 10 }}>
        <Link href="/courses">See what the course covers first</Link>
      </p>
    </div>
  );
}
