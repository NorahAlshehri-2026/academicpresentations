import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { MAX_ATTEMPTS, ACTIVITY_INFO } from "@/app/_lib/activities";
import { mmss, fmtDate } from "@/app/_lib/format";

export default async function MyRecordings() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/recordings");

  const supabase = serverClient();
  const { data } = await supabase
    .from("submissions")
    .select(
      "id, lesson_id, attempt_no, duration_seconds, created_at, " +
        "lesson:lessons!inner(id, course_id, title, kind, activity_key, target_seconds, unit, order_no), " +
        "feedback(source), submission_shares(shared_with)"
    )
    .eq("student_id", profile.id)
    .eq("lesson.kind", "practice");

  const subs = (data ?? []) as any[];
  const ids = subs.map((s) => s.id);
  const { data: marks } = ids.length
    ? await supabase.from("current_grades").select("submission_id, total").in("submission_id", ids)
    : { data: [] as any[] };
  const markOf = (id: string) => (marks ?? []).find((m: any) => m.submission_id === id)?.total ?? null;

  // one card per activity, in course order
  const byLesson = new Map<string, any[]>();
  subs.forEach((s) => byLesson.set(s.lesson_id, [...(byLesson.get(s.lesson_id) ?? []), s]));
  const groups = Array.from(byLesson.values()).sort(
    (a, b) => a[0].lesson.unit - b[0].lesson.unit || a[0].lesson.order_no - b[0].lesson.order_no
  );

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3>My recordings</h3>
          <span className="tiny muted">{subs.length} saved</span>
        </div>
        <p className="tiny muted" style={{ marginTop: 6 }}>
          Two attempts per activity. Attempt 1 can be deleted; attempt 2 is final and stays. Open an attempt to share
          it with a classmate.
        </p>
      </div>

      {groups.length ? (
        groups.map((at) => {
          const l = at[0].lesson;
          const done = at.some((s: any) => s.attempt_no >= MAX_ATTEMPTS);
          return (
            <div className="card" key={l.id}>
              <div className="spread">
                <h3>{l.title}</h3>
                <span className={`pill ${done ? "c2" : "c5"}`}>
                  {done ? `${MAX_ATTEMPTS} of ${MAX_ATTEMPTS} · done` : `1 of ${MAX_ATTEMPTS} used`}
                </span>
              </div>
              <div className="meta">{ACTIVITY_INFO[l.activity_key]?.source ?? `Unit ${l.unit}`}</div>
              <div style={{ marginTop: 6 }}>
                {at
                  .sort((a: any, b: any) => a.attempt_no - b.attempt_no)
                  .map((s: any) => {
                    const mark = markOf(s.id);
                    const fb = (s.feedback ?? []).length;
                    const ai = (s.feedback ?? []).some((f: any) => f.source === "ai");
                    const sh = (s.submission_shares ?? []).length;
                    return (
                      <Link key={s.id} className="attrow" href={`/learn/${l.course_id}/${l.id}#attempt-${s.attempt_no}`}>
                        <span className={`pill ${s.attempt_no >= MAX_ATTEMPTS ? "c3" : "c5"}`}>
                          {s.attempt_no >= MAX_ATTEMPTS ? "Attempt 2 · final" : "Attempt 1"}
                        </span>
                        <div className="grow">
                          <div className="tiny muted">
                            {mmss(s.duration_seconds)} of {mmss(l.target_seconds)} · {fmtDate(s.created_at)} · {fb} feedback
                            {sh ? ` · shared with ${sh}` : ""}
                            {ai ? " · AI" : ""}
                          </div>
                        </div>
                        {mark != null && <span className="pill c2">{mark}/20</span>}
                        <span className="muted">›</span>
                      </Link>
                    );
                  })}
              </div>
              {!done && (
                <Link className="btn ghost sm" style={{ marginTop: 10 }} href={`/learn/${l.course_id}/${l.id}`}>
                  Record attempt 2
                </Link>
              )}
            </div>
          );
        })
      ) : (
        <div className="card">
          <p className="small muted">Nothing yet. Pick an activity and record your first attempt.</p>
          <Link className="btn gold block" href="/activities" style={{ marginTop: 10 }}>Choose an activity</Link>
        </div>
      )}
    </>
  );
}
