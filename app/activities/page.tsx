import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { loadCourse } from "@/app/_lib/course";
import { ACTIVITY_INFO, MAX_ATTEMPTS, unitMeta } from "@/app/_lib/activities";
import { mmss } from "@/app/_lib/format";
import { PreviewBanner } from "@/app/_components/StudentPreview";
import { studentDue, dueState, fmtDueDay, fmtDueTime } from "@/app/_lib/due";

export default async function ActivitiesPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/activities");

  const { course, lessons } = await loadCourse();
  const tasks = lessons.filter((l) => l.kind === "practice");

  const { data: mine } = await serverClient()
    .from("submissions")
    .select("lesson_id, attempt_no")
    .eq("student_id", profile.id);

  // deadlines set by the teacher of the student's class (optional)
  const { due } = await studentDue(serverClient(), profile.id);
  const duePill = (lessonId: string) => {
    const at = due[lessonId];
    if (!at) return null;
    const st = dueState(at);
    const started = (mine ?? []).some((s: any) => s.lesson_id === lessonId);
    return (
      <span className={`pill due-pill ${st === "past" && !started ? "overdue" : st}`} title="Riyadh time">
        {st === "past" ? (started ? "Deadline passed" : "Overdue") : "Due"} {fmtDueDay(at)} · {fmtDueTime(at)}
      </span>
    );
  };

  const attemptPill = (lessonId: string) => {
    const at = (mine ?? []).filter((s: any) => s.lesson_id === lessonId);
    if (!at.length) return null;
    const done = at.some((s: any) => s.attempt_no >= MAX_ATTEMPTS);
    return (
      <span className={`pill ${done ? "c2" : "c5"}`}>
        {done ? `${MAX_ATTEMPTS} of ${MAX_ATTEMPTS} · done` : `1 of ${MAX_ATTEMPTS} used`}
      </span>
    );
  };

  const units = Array.from(new Set(tasks.map((t) => t.unit))).sort((a, b) => a - b);

  return (
    <>
      {profile.role !== "student" && <PreviewBanner />}
      <div className="card">
        <h3>{tasks.length === 10 ? "Ten" : tasks.length} timed activities</h3>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          Grouped by unit. Two saved attempts per activity. In units 1–4 a classmate gives feedback with a short checklist; the final presentation is marked on the full rubric.
        </p>
      </div>

      {!course ? (
        <div className="card">
          <p className="small muted">You are not in a class yet. Open the class link your teacher shared to join.</p>
        </div>
      ) : (
        units.map((u) => {
          const items = tasks.filter((t) => t.unit === u);
          const label = `Unit ${u} · ${unitMeta(u).title}`;
          return (
            <section key={u}>
              <h2 className="small muted" style={{ margin: "16px 0 8px" }}>
                <span style={{ textTransform: "uppercase", letterSpacing: ".6px", fontSize: 11, fontWeight: 700 }}>{label}</span>
              </h2>
              {items.map((t) => {
                const info = ACTIVITY_INFO[t.activity_key ?? ""];
                return (
                  <Link key={t.id} href={`/learn/${course.id}/${t.id}`} className="card" style={{ display: "block", textDecoration: "none" }}>
                    <div className="spread">
                      <h3>{t.title}</h3>
                      <div className="row" style={{ gap: 6 }}>
                        {duePill(t.id)}
                        {attemptPill(t.id)}
                        <span className="pill" style={{ background: `color-mix(in srgb, ${unitMeta(t.unit).colour} 14%, transparent)`, color: unitMeta(t.unit).colour }}>
                          {mmss(t.target_seconds)}
                        </span>
                      </div>
                    </div>
                    <p className="small muted" style={{ margin: "4px 0 0" }}>{info?.task ?? ""}</p>
                    <div className="meta">
                      <span className="uchip" style={{ ["--unit" as any]: unitMeta(t.unit).colour }}>Unit {t.unit}</span>
                      {info?.source ?? `Unit ${t.unit}`} · prep {mmss(t.prep_seconds)} · speak {mmss(t.target_seconds)}
                    </div>
                  </Link>
                );
              })}
            </section>
          );
        })
      )}
    </>
  );
}
