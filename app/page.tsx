import Link from "next/link";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { loadCourse } from "@/app/_lib/course";
import { firstName, mmss } from "@/app/_lib/format";
import Icon from "@/app/_components/Icon";
import { PreviewBanner } from "@/app/_components/StudentPreview";

type Tile = { href: string; icon: string; colour: string; title: string; text: string };

function Tiles({ items }: { items: Tile[] }) {
  return (
    <div className="tiles">
      {items.map((t) => (
        <Link key={t.title} href={t.href} className="tile" style={{ ["--ic" as any]: t.colour }}>
          <Icon name={t.icon} />
          <h3>{t.title}</h3>
          <p>{t.text}</p>
        </Link>
      ))}
    </div>
  );
}

function NextStep({ title = "Your next step", text, href, label, icon }: { title?: string; text: React.ReactNode; href: string; label: string; icon: string }) {
  return (
    <div className="nextstep">
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="btn big block" href={href}>
        <Icon name={icon} size={20} /> {label}
      </Link>
    </div>
  );
}

const STUDENT_TILES: Tile[] = [
  { href: "/units", icon: "book", colour: "var(--u1)", title: "Learn", text: "Review presentation skills" },
  { href: "/activities", icon: "video", colour: "var(--u2)", title: "Practise", text: "Record and upload" },
  { href: "/recordings", icon: "message", colour: "var(--u3)", title: "Feedback", text: "Review your performance" },
  { href: "/progress", icon: "chart", colour: "var(--u4)", title: "Progress", text: "Track your improvement" },
];

export default async function Home({ searchParams }: { searchParams?: { preview?: string } }) {
  let profile = null;
  try {
    profile = await currentProfile();
  } catch {}

  // ---------------------------------------------------------------- visitors
  if (!profile) {
    return (
      <>
        <div className="pagehead">
          <h1>Foundations of Academic Presentations</h1>
          <p className="lead">Plan, structure and deliver an academic presentation, with timed practice and feedback.</p>
        </div>
        <Tiles
          items={[
            { href: "/courses", icon: "book", colour: "var(--u1)", title: "Learn", text: "Review presentation skills" },
            { href: "/login", icon: "video", colour: "var(--u2)", title: "Practise", text: "Record and upload" },
            { href: "/rubric", icon: "message", colour: "var(--u3)", title: "Feedback", text: "From classmates, AI and your teacher" },
            { href: "/guide", icon: "chart", colour: "var(--u4)", title: "Progress", text: "Track your improvement" },
          ]}
        />
        <div className="nextstep">
          <h3>Joining your class</h3>
          <p>
            Joining is by link only. Open the class link your teacher shared in the announcement or WhatsApp group, then
            add your name, email and a password. Already joined? Sign in.
          </p>
          <Link className="btn big block" href="/login">
            <Icon name="login" size={20} /> Sign in
          </Link>
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------- staff
  if (profile.role !== "student" && searchParams?.preview === "student") {
    // the student Home, with sample details, for teachers and administrators
    const { course, lessons } = await loadCourse();
    const first = lessons.find((l) => l.kind === "practice") ?? null;
    return (
      <>
        <PreviewBanner />
        <div className="pagehead">
          <h1>Welcome back, Sara</h1>
          <p className="lead">Section 101 · Semester 1, 2026-27 <span className="tiny">(sample details)</span></p>
        </div>
        <Tiles items={STUDENT_TILES} />
        {course && first ? (
          <NextStep
            text={
              <>
                <b>{first.title}</b>: prepare for {mmss(first.prep_seconds ?? 0)}, then speak for {mmss(first.target_seconds ?? 0)}.
              </>
            }
            href={`/learn/${course.id}/${first.id}`}
            label="Record your first activity"
            icon="mic"
          />
        ) : (
          <NextStep text="Record your academic presentation and submit it for feedback." href="/activities" label="Upload Presentation" icon="mic" />
        )}
      </>
    );
  }

  if (profile.role !== "student") {
    return (
      <>
        <div className="pagehead">
          <h1>Welcome back, {firstName(profile.full_name)}</h1>
          <p className="lead">{profile.role === "admin" ? "Administrator" : "Teacher"} · Foundations of Academic Presentations</p>
        </div>
        <Tiles
          items={[
            { href: "/teach", icon: "users", colour: "var(--u1)", title: "My classes", text: "Join links, students and marking" },
            { href: "/units", icon: "book", colour: "var(--u2)", title: "Units", text: "What your students read" },
            { href: "/activities", icon: "video", colour: "var(--u3)", title: "Activities", text: "The ten speaking tasks" },
            profile.role === "admin"
              ? { href: "/admin", icon: "shield", colour: "var(--u4)", title: "Admin", text: "Classes, people and invitations" }
              : { href: "/rubric", icon: "list", colour: "var(--u4)", title: "Rubric", text: "The five marking criteria" },
          ]}
        />
        <NextStep
          text="Open your classes to share join links, listen to new recordings and give official marks."
          href="/teach"
          label="Open my classes"
          icon="arrow"
        />
        <p className="small center" style={{ marginTop: 14 }}>
          <Link href="/?preview=student">See the student Home page (student preview)</Link>
        </p>
      </>
    );
  }

  // ---------------------------------------------------------------- students
  const supabase = serverClient();
  const [{ data: subs }, { data: shared }, { data: enrol }, { course, lessons }] = await Promise.all([
    supabase.from("submissions").select("lesson_id").eq("student_id", profile.id),
    supabase
      .from("submission_shares")
      .select("submission_id, submission:submissions!inner(feedback(author_id))")
      .eq("shared_with", profile.id),
    supabase
      .from("enrolments")
      .select("section:sections(number, term)")
      .eq("student_id", profile.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    loadCourse(),
  ]);

  const attempted = new Set(((subs ?? []) as any[]).map((s) => s.lesson_id));
  const practice = lessons.filter((l) => l.kind === "practice");
  const next = practice.find((l) => !attempted.has(l.id)) ?? null;
  const waiting = ((shared ?? []) as any[]).filter(
    (x) => !(x.submission?.feedback ?? []).some((f: any) => f.author_id === profile!.id)
  ).length;
  const sec = (enrol as any)?.section;

  return (
    <>
      <div className="pagehead">
        <h1>Welcome back, {firstName(profile.full_name)}</h1>
        <p className="lead">
          {sec ? `Section ${sec.number} · ${sec.term}` : "Open your class link to join your class."}
        </p>
      </div>

      <Tiles items={STUDENT_TILES} />

      {waiting > 0 && (
        <Link className="nextstep notice" href="/shared">
          <h3>Classmates are waiting for your feedback</h3>
          <p>
            {waiting} recording{waiting === 1 ? " is" : "s are"} shared with you. Open Shared with me to listen and score.
          </p>
        </Link>
      )}

      {course && next ? (
        <NextStep
          text={
            <>
              <b>{next.title}</b>: prepare for {mmss(next.prep_seconds ?? 0)}, then speak for {mmss(next.target_seconds ?? 0)}.
            </>
          }
          href={`/learn/${course.id}/${next.id}`}
          label={attempted.size ? "Record your next activity" : "Record your first activity"}
          icon="mic"
        />
      ) : (
        <NextStep
          text="You have recorded every activity. See how your marks are moving across the five criteria."
          href="/progress"
          label="View my progress"
          icon="chart"
        />
      )}
    </>
  );
}
