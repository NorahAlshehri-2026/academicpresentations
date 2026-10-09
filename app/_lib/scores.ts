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
