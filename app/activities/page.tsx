import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { loadCourse } from "@/app/_lib/course";
import { ACTIVITY_INFO, SKILL_GROUPS, FOCUS, CRIT_CLASS, MAX_ATTEMPTS } from "@/app/_lib/activities";
import { mmss } from "@/app/_lib/format";
import { PreviewBanner } from "@/app/_components/StudentPreview";

export default async function ActivitiesPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/activities");

  const { course, lessons } = await loadCourse();
  const tasks = lessons.filter((l) => l.kind === "practice");

  const { data: mine } = await serverClient()
    .from("submissions")
    .select("lesson_id, attempt_no")
    .eq("student_id", profile.id);

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

  const groupOf = (key: string | null) => ACTIVITY_INFO[key ?? ""]?.skill ?? "all";

  return (
    <>
      {profile.role !== "student" && <PreviewBanner />}
      <div className="card">
        <h3>{tasks.length === 10 ? "Ten" : tasks.length} timed activities</h3>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          Grouped by the rubric criterion each one trains hardest. Two saved attempts per activity.
        </p>
      </div>

      {!course ? (
        <div className="card">
          <p className="small muted">You are not in a class yet. Open the class link your teacher shared to join.</p>
        </div>
      ) : (
        SKILL_GROUPS.map(([k, label]) => {
          const items = tasks.filter((t) => groupOf(t.activity_key) === k);
          if (!items.length) return null;
          return (
            <section key={k}>
              <h2 className="small muted" style={{ margin: "16px 0 8px" }}>
                <span style={{ textTransform: "uppercase", letterSpacing: ".6px", fontSize: 11, fontWeight: 700 }}>{label}</span>
              </h2>
              {items.map((t) => {
                const info = ACTIVITY_INFO[t.activity_key ?? ""];
                const cls = CRIT_CLASS[(FOCUS[t.activity_key ?? ""] ?? ["intro"])[0]];
                return (
                  <Link key={t.id} href={`/learn/${course.id}/${t.id}`} className="card" style={{ display: "block", textDecoration: "none" }}>
                    <div className="spread">
                      <h3>{t.title}</h3>
                      <div className="row" style={{ gap: 6 }}>
                        {attemptPill(t.id)}
                        <span className={`pill ${cls}`}>{mmss(t.target_seconds)}</span>
                      </div>
                    </div>
                    <p className="small muted" style={{ margin: "4px 0 0" }}>{info?.task ?? ""}</p>
                    <div className="meta">
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
