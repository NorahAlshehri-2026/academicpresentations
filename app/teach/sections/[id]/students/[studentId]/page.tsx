import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentProfile, serverClient, homeFor } from "@/app/_lib/supabase";
import { mmss, fmtDate } from "@/app/_lib/format";
import { feedbackTotal } from "@/app/_lib/scores";
import { MAX_ATTEMPTS } from "@/app/_lib/activities";
import ProfileCards, { type ProfileSubmission } from "@/app/_components/ProfileCards";

/** One student in one class: their profile and every attempt, ready to mark. */
export default async function StudentInClass({ params }: { params: { id: string; studentId: string } }) {
  const profile = await currentProfile();
  if (!profile) redirect(`/login?next=/teach/sections/${params.id}/students/${params.studentId}`);
  if (profile.role === "student") redirect(homeFor(profile.role));

  const supabase = serverClient();

  const [{ data: student }, { data: section }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("id", params.studentId).maybeSingle(),
    supabase.from("sections").select("id, number, course_id, courses(title)").eq("id", params.id).maybeSingle(),
  ]);
  if (!student || !section) notFound();

  const [{ data: subsRaw }, { data: tasks }, { data: marks }] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, lesson_id, attempt_no, duration_seconds, created_at, feedback(source, author_id, scores)")
      .eq("section_id", params.id)
      .eq("student_id", params.studentId),
    supabase
      .from("lessons")
      .select("id, title, unit, order_no, target_seconds")
      .eq("course_id", (section as any).course_id)
      .eq("kind", "practice")
      .order("unit")
      .order("order_no"),
    supabase.from("current_grades").select("submission_id, total").eq("student_id", params.studentId).eq("section_id", params.id),
  ]);

  const subs = (subsRaw ?? []) as any[];
  const taskList = (tasks ?? []) as any[];
  const markOf = (id: string) => (marks ?? []).find((m: any) => m.submission_id === id)?.total ?? null;

  const rows: ProfileSubmission[] = subs.map((s) => ({
    id: s.id,
    created_at: s.created_at,
    duration_seconds: s.duration_seconds,
    lesson_id: s.lesson_id,
    target_seconds: taskList.find((t) => t.id === s.lesson_id)?.target_seconds ?? null,
    feedback: s.feedback ?? [],
    mark: markOf(s.id),
  }));

  return (
    <>
      <div className="card">
        <Link className="btn ghost sm" href={`/teach/sections/${params.id}`}>← Section {(section as any).number}</Link>
        <h3 style={{ marginTop: 12, fontSize: 18 }}>{(student as any).full_name}</h3>
        <div className="meta">{(student as any).email} · {(section as any).courses?.title}</div>
      </div>

      {rows.length > 0 && <ProfileCards title="Profile" subs={rows} taskCount={taskList.length} />}

      {taskList.map((t) => {
        const att = subs.filter((s) => s.lesson_id === t.id).sort((a, b) => a.attempt_no - b.attempt_no);
        if (!att.length) return null;
        return (
          <div className="card" key={t.id}>
            <div className="spread">
              <h3>{t.title}</h3>
              <span className={`pill ${att.some((s) => s.attempt_no >= MAX_ATTEMPTS) ? "c2" : "c5"}`}>
                {att.length} of {MAX_ATTEMPTS}
              </span>
            </div>
            <div style={{ marginTop: 6 }}>
              {att.map((s) => {
                const mark = markOf(s.id);
                const fbAvg = feedbackTotal(s.feedback ?? []);
                const peers = (s.feedback ?? []).filter((f: any) => f.source === "peer").length;
                return (
                  <Link key={s.id} className="attrow" href={`/review/${s.id}`}>
                    <span className={`pill ${s.attempt_no >= MAX_ATTEMPTS ? "c3" : "c5"}`}>Attempt {s.attempt_no}</span>
                    <div className="grow">
                      <div className="tiny muted">
                        {mmss(s.duration_seconds)} of {mmss(t.target_seconds)} · {fmtDate(s.created_at)} · {peers} classmate
                        {peers === 1 ? "" : "s"}
                        {fbAvg != null ? ` · feedback avg ${fbAvg}/20` : ""}
                      </div>
                    </div>
                    {mark != null ? <span className="pill c2">{mark}/20</span> : <span className="pill c5">To mark</span>}
                    <span className="muted">›</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {!subs.length && (
        <div className="card">
          <p className="small muted">No recordings yet.</p>
        </div>
      )}
    </>
  );
}
