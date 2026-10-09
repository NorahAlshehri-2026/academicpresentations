/** Small formatting helpers shared by server and client components. */

export const mmss = (s: number | null | undefined) => {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};

export const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

export const firstName = (n: string | null | undefined) => String(n ?? "").trim().split(/\s+/)[0] ?? "";

const FILLERS = ["um", "uh", "er", "erm", "like", "you know", "basically", "actually", "sort of", "kind of"];

export type Metrics = {
  words: number;
  wpm: number | null;
  fillers: number;
  secs: number;
  target: number;
  timing: string;
  withinTarget: boolean;
};

/** Length, pace and filler count, worked out from the transcript and timing. */
export function metricsOf(text: string | null | undefined, secs: number, target: number): Metrics {
  const t = text ?? "";
  const words = t.trim().split(/\s+/).filter(Boolean);
  const wpm = secs > 5 && words.length ? Math.round(words.length / (secs / 60)) : null;
  const low = ` ${t.toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ")} `;
  let fillers = 0;
  FILLERS.forEach((f) => {
    const m = low.match(new RegExp(`\\s${f.replace(/ /g, "\\s")}(?=\\s)`, "g"));
    if (m) fillers += m.length;
  });
  const diff = secs - target;
  const within = Math.abs(diff) <= target * 0.15;
  return {
    words: words.length,
    wpm,
    fillers,
    secs: Math.round(secs),
    target,
    withinTarget: within,
    timing: within ? "within target" : diff > 0 ? `over by ${mmss(diff)}` : `under by ${mmss(-diff)}`,
  };
}

export const paceLabel = (wpm: number) => (wpm < 110 ? "slow" : wpm > 165 ? "fast" : "comfortable");

/** Video recordings are saved with a "-v" suffix on the file name. */
export const isVideoPath = (p: string | null | undefined) => /-v\.(webm|mp4|ogg)$/.test(p ?? "");
