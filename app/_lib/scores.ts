import { RUBRIC } from "./rubric";

type Scored = { scores?: Record<string, number> | null };

/** Every per-criterion score (1–4) found in a set of feedback rows. */
export function allScores(feedback: Scored[]): [string, number][] {
  const out: [string, number][] = [];
  feedback.forEach((f) => {
    if (!f.scores) return;
    for (const c of RUBRIC) {
      const v = Number(f.scores[c.id]);
      if (v >= 1 && v <= 4) out.push([c.id, v]);
    }
  });
  return out;
}

/** Average out of 20 across every score given on one recording. */
export function feedbackTotal(feedback: Scored[]): number | null {
  const s = allScores(feedback);
  if (!s.length) return null;
  return Math.round((s.reduce((a, [, v]) => a + v, 0) / s.length) * 5);
}

/** Average per criterion (out of 4) across many feedback rows. */
export function criterionAverages(feedback: Scored[]): Record<string, number | null> {
  const sum: Record<string, number> = {};
  const n: Record<string, number> = {};
  allScores(feedback).forEach(([k, v]) => {
    sum[k] = (sum[k] ?? 0) + v;
    n[k] = (n[k] ?? 0) + 1;
  });
  const out: Record<string, number | null> = {};
  RUBRIC.forEach((c) => {
    out[c.id] = n[c.id] ? sum[c.id] / n[c.id] : null;
  });
  return out;
}

export function weakest(avg: Record<string, number | null>) {
  return RUBRIC.filter((c) => avg[c.id] != null).sort((a, b) => (avg[a.id] as number) - (avg[b.id] as number))[0];
}

type Task = { id: string; unit: number };
type Attempt = { id: string; student_id: string; lesson_id: string; attempt_no: number; created_at?: string | null };
type Mark = { submission_id: string; total: number | string };

/** Each speaking activity is worth this many points; ten activities make 100. */
export const ACTIVITY_POINTS = 10;

/** Where a student is with one activity: not started, recorded but not marked, or marked. */
export type ActivityState = "none" | "recorded" | "marked";

/**
 * The course grade out of 100: each activity is worth 10 points, worked out
 * from its official mark out of 20 (16/20 = 8 points). An activity counts with
 * the mark of its latest marked attempt; an activity not yet marked counts as
 * 0, so the total builds up over the term and is final once every activity is
 * marked. Units are shown as subtotals (a unit with three activities is worth
 * 30). With other than ten activities, the total is scaled to 100.
 *
 * With deadlines (`due`, lesson id -> ISO time), each activity also says
 * whether the attempt that counts was recorded late, and whether it is
 * overdue (nothing recorded and the deadline has passed). Late work is not
 * marked down automatically: the teacher decides.
 */
export function courseGrade(
  studentId: string,
  tasks: Task[],
  attempts: Attempt[],
  marks: Mark[],
  due: Record<string, string> = {},
  now = Date.now()
) {
  const markOf = (subId: string) => marks.find((m) => m.submission_id === subId);
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const activities = tasks.map((t) => {
    const mine = attempts
      .filter((s) => s.student_id === studentId && s.lesson_id === t.id)
      .sort((a, b) => b.attempt_no - a.attempt_no);
    const m = mine.map((s) => markOf(s.id)).find(Boolean);
    const mark = m ? Number(m.total) : null;
    const points = mark === null ? null : r1((Math.max(0, Math.min(20, mark)) / 20) * ACTIVITY_POINTS);
    const state: ActivityState = mark !== null ? "marked" : mine.length ? "recorded" : "none";
    const dueAt = due[t.id] ?? null;
    const counted = m ? mine.find((s) => s.id === m.submission_id) : mine[0];
    const late = !!(dueAt && counted?.created_at && new Date(counted.created_at).getTime() > new Date(dueAt).getTime());
    const overdue = !!(dueAt && state === "none" && new Date(dueAt).getTime() < now);
    return {
      taskId: t.id,
      unit: t.unit,
      attempts: mine.length,
      latestId: mine[0]?.id ?? null,
      // a newer attempt is waiting for a mark
      pending: !!mine[0] && !markOf(mine[0].id),
      mark,
      points,
      state,
      dueAt,
      late,
      overdue,
    };
  });

  const units = Array.from(new Set(tasks.map((t) => t.unit)))
    .sort((a, b) => a - b)
    .map((u) => {
      const acts = activities.filter((a) => a.unit === u);
      return {
        unit: u,
        points: r1(acts.reduce((s, a) => s + (a.points ?? 0), 0)),
        max: acts.length * ACTIVITY_POINTS,
        marked: acts.filter((a) => a.state === "marked").length,
        of: acts.length,
      };
    });

  const earned = r1(activities.reduce((s, a) => s + (a.points ?? 0), 0));
  const max = tasks.length * ACTIVITY_POINTS;
  return {
    activities,
    units,
    earned,
    max,
    total: max ? r1((earned / max) * 100) : 0,
    marked: activities.filter((a) => a.state === "marked").length,
    done: activities.filter((a) => a.state !== "none").length,
    late: activities.filter((a) => a.late).length,
    overdue: activities.filter((a) => a.overdue).length,
    of: tasks.length,
  };
}
