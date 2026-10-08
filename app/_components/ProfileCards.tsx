import { RUBRIC, band } from "@/app/_lib/rubric";
import { criterionAverages, feedbackTotal, weakest } from "@/app/_lib/scores";
import { mmss } from "@/app/_lib/format";
import { Radar, Ring, Spark, RADAR_LABELS } from "./Charts";

export type ProfileSubmission = {
  id: string;
  created_at: string;
  duration_seconds: number | null;
  lesson_id: string;
  target_seconds: number | null;
  feedback: { scores: Record<string, number> | null }[];
  mark: number | null;
};

/**
 * A student's presentation profile: scores by criterion, where the marks are,
 * timing and coverage, and the trend. Used on the student's own progress page
 * and on the teacher's view of a student.
 */
export default function ProfileCards({
  title,
  subs,
  taskCount,
}: {
  title: string;
  subs: ProfileSubmission[];
  taskCount: number;
}) {
  const allFb = subs.flatMap((s) => s.feedback);
  const avg = criterionAverages(allFb);
  const weak = weakest(avg);

  // newest first: the official mark if there is one, otherwise the feedback average
  const scored = [...subs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((s) => s.mark ?? feedbackTotal(s.feedback))
    .filter((t): t is number => t != null);
  const latest = scored[0] ?? null;
  const trend = [...scored].reverse();

  const done = new Set(subs.map((s) => s.lesson_id)).size;
  const spoken = subs.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
  const onTime = subs.filter((s) => {
    const t = s.target_seconds ?? 1;
    return Math.abs((s.duration_seconds ?? 0) - t) <= t * 0.15;
  }).length;

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3>{title}</h3>
          {latest != null && (
            <div style={{ textAlign: "right" }}>
              <div className="total">{latest}<span className="small muted">/20</span></div>
              <div className="band" style={{ color: band(latest)[1] }}>{band(latest)[0]}</div>
            </div>
          )}
        </div>
        <p className="tiny muted">{subs.length} saved attempt{subs.length === 1 ? "" : "s"}</p>
        <div style={{ marginTop: 12 }}>
          <Radar values={RUBRIC.map((c) => avg[c.id] ?? 0)} labels={RADAR_LABELS} />
        </div>
        <p className="tiny muted center">Average of every classmate, teacher and AI score, out of 4.</p>
      </div>

      <div className="card">
        <h3>Where the marks are</h3>
        <div style={{ marginTop: 8 }}>
          {RUBRIC.map((c) => (
            <div className="score-row" key={c.id}>
              <span className="nm">{c.n}. {c.name}</span>
              <div className="rbar"><i style={{ width: `${avg[c.id] ? ((avg[c.id] as number) / 4) * 100 : 0}%` }} /></div>
              <b className="small" style={{ width: 34, textAlign: "right" }}>{avg[c.id] ? (avg[c.id] as number).toFixed(1) : "—"}</b>
            </div>
          ))}
        </div>
        {weak && (
          <div className="note" style={{ marginTop: 12 }}>
            <b>Thinnest criterion:</b> {weak.name}. Aim at this next.
          </div>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-around" }}>
          <Ring pct={taskCount ? done / taskCount : 0} label={`${done}/${taskCount}`} sub="tasks" />
          <Ring pct={subs.length ? onTime / subs.length : 0} label={`${subs.length ? Math.round((100 * onTime) / subs.length) : 0}%`} sub="within time" />
          <Ring pct={Math.min(1, spoken / 1800)} label={mmss(spoken)} sub="spoken" />
        </div>
      </div>

      {trend.length > 1 && (
        <div className="card">
          <h3>Scores over time</h3>
          <div style={{ marginTop: 10 }}><Spark values={trend} /></div>
          <p className="tiny muted">{trend.length} scored attempts, oldest to newest, out of 20.</p>
        </div>
      )}
    </>
  );
}
