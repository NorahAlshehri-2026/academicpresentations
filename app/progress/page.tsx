import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import ProfileCards, { type ProfileSubmission } from "@/app/_components/ProfileCards";
import { CRIT_CLASS, FOCUS, MAX_ATTEMPTS } from "@/app/_lib/activities";

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

  if (!rows.length) {
    return (
      <div className="card">
        <h3>Your presentation profile</h3>
        <p className="small muted">
          Nothing recorded yet. Finish one speaking task and this page fills with your scores by criterion, your
          timing, and how you move over the term.
        </p>
        <Link className="btn gold block" style={{ marginTop: 12 }} href="/activities">Choose an activity</Link>
      </div>
    );
  }

  return (
    <>
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
