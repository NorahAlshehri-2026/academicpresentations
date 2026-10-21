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
type Attempt = { id: string; student_id: string; lesson_id: string; attempt_no: number };
type Mark = { submission_id: string; total: number | string };

/**
 * The course grade out of 100: each unit is worth 20, and a unit's mark out of
 * 20 is the average of its activities' official marks. An activity counts
 * with the mark of its latest marked attempt; an activity not yet marked
 * counts as 0, so the total builds up over the term and is final once every
 * activity is marked. (With other than five units, the total is scaled to 100.)
 */
export function courseGrade(studentId: string, tasks: Task[], attempts: Attempt[], marks: Mark[]) {
  const markOf = (subId: string) => marks.find((m) => m.submission_id === subId);
  const units = Array.from(new Set(tasks.map((t) => t.unit))).sort((a, b) => a - b);
  const activity = (taskId: string): number | null => {
    const latest = attempts
      .filter((s) => s.student_id === studentId && s.lesson_id === taskId)
      .sort((a, b) => b.attempt_no - a.attempt_no)
      .map((s) => markOf(s.id))
      .find(Boolean);
    return latest ? Number(latest.total) : null;
  };
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const byUnit = units.map((u) => {
    const ts = tasks.filter((t) => t.unit === u);
    const got = ts.map((t) => activity(t.id));
    const marked = got.filter((n) => n !== null).length;
    const sum = got.reduce<number>((a, n) => a + (n ?? 0), 0);
    return { unit: u, mark: ts.length ? r1(sum / ts.length) : 0, marked, of: ts.length };
  });
  const raw = byUnit.reduce((a, u) => a + u.mark, 0);
  const total = units.length ? r1((raw / (units.length * 20)) * 100) : 0;
  const markedAll = byUnit.reduce((a, u) => a + u.marked, 0);
  return { units: byUnit, total, marked: markedAll, of: tasks.length };
}
