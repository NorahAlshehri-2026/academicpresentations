import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import ProfileCards, { type ProfileSubmission } from "@/app/_components/ProfileCards";
import { CRIT_CLASS, FOCUS, MAX_ATTEMPTS } from "@/app/_lib/activities";
import { courseGrade } from "@/app/_lib/scores";
import { StudentTracker, Legend } from "@/app/_components/ProgressTracker";
import { studentDue } from "@/app/_lib/due";

export default async function ProgressPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/progress");

  const supabase = serverClient();

  const { data: subsRaw } = await supabase
    .from("submissions")
    .select("id, lesson_id, attempt_no, duration_seconds, created_at, lesson:lessons!inner(kind, title, activity_key, target_seconds, course_id), feedback(scores)")
    .eq("student_id", profile.id)
    .eq("lesson.kind", "practice");

  const subs = (subsRaw ?? []) as any[];
  const ids = subs.map((s) => s.id);
  const { data: marks } = ids.length
    ? await supabase.from("current_grades").select("submission_id, total").in("submission_id", ids)
    : { data: [] as any[] };

  // the practice tasks of the courses this student is in
  const { data: tasks } = await supabase
    .from("lessons")
    .select("id, title, activity_key, course_id, unit, order_no")
    .eq("kind", "practice")
    .order("unit")
    .order("order_no");

  const rows: ProfileSubmission[] = subs.map((s) => ({
    id: s.id,
    created_at: s.created_at,
    duration_seconds: s.duration_seconds,
    lesson_id: s.lesson_id,
    target_seconds: s.lesson?.target_seconds ?? null,
    feedback: s.feedback ?? [],
    mark: (marks ?? []).find((m: any) => m.submission_id === s.id)?.total ?? null,
  }));

  // the digital tracker: 10 points per activity, 100 in all
  const taskList = (tasks ?? []) as any[];
  const { due } = await studentDue(supabase, profile.id);
  const hasDue = Object.keys(due).length > 0;
  const grade = courseGrade(
    profile.id,
    taskList,
    subs.map((s) => ({ id: s.id, student_id: profile.id, lesson_id: s.lesson_id, attempt_no: s.attempt_no, created_at: s.created_at })),
    (marks ?? []) as any[],
    due
  );
  const tracker = taskList.length > 0 && (
    <div className="card">
      <div className="spread">
        <h3>Your points</h3>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill">10 activities × 10 points = 100</span>
          {hasDue && (
            <a className="btn sm act k-calendar" href="/calendar" title="Opens in Apple Calendar, Google Calendar, Outlook or any calendar app">
              ⬇ Add my deadlines to calendar
            </a>
          )}
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: 4 }}>
        Each activity is worth 10 points, worked out from your teacher&apos;s official mark out of 20 (16/20 = 8
        points). Tap an activity to open it.
      </p>
      <Legend />
      <div style={{ marginTop: 12 }}>
        <StudentTracker
          tasks={taskList}
          grade={grade}
          hrefFor={(a) => {
            const t = taskList.find((x) => x.id === a.taskId);
            return t ? `/learn/${t.course_id}/${t.id}` : null;
          }}
        />
      </div>
    </div>
  );

  if (!rows.length) {
    return (
      <>
        {tracker}
        <div className="card">
          <h3>Your presentation profile</h3>
          <p className="small muted">
            Nothing recorded yet. Finish one speaking task and this page fills with your scores by criterion, your
            timing, and how you move over the term.
          </p>
          <Link className="btn gold block" style={{ marginTop: 12 }} href="/activities">Choose an activity</Link>
        </div>
      </>
    );
  }

  return (
    <>
      {tracker}
      <ProfileCards title="Your presentation profile" subs={rows} taskCount={tasks?.length ?? 10} />
      <div className="card">
        <h3>Task coverage</h3>
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          {(tasks ?? []).map((t: any) => {
            const n = subs.filter((s) => s.lesson_id === t.id).length;
            const cls = n ? CRIT_CLASS[(FOCUS[t.activity_key] ?? ["intro"])[0]] : "c0";
            return (
              <Link key={t.id} href={`/learn/${t.course_id}/${t.id}`} className={`pill ${cls}`} style={{ textDecoration: "none" }}>
                {t.title}{n ? ` · ${Math.min(n, MAX_ATTEMPTS)}/${MAX_ATTEMPTS}` : ""}
              </Link>
            );
          })}
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Your teacher sees your recordings and scores in their gradebook. There is nothing to send.
        </p>
      </div>
    </>
  );
}
