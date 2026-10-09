import Link from "next/link";
import { mmss, metricsOf, paceLabel } from "@/app/_lib/format";
import FeedbackList, { type FeedbackRow } from "./FeedbackList";

/** The strip at the top of a page that a teacher or administrator is seeing as a student would. */
export function PreviewBanner({ saving }: { saving?: boolean }) {
  return (
    <div className="note" style={{ marginBottom: 12, borderLeft: "4px solid var(--gold)" }}>
      <b>Student preview.</b>{" "}
      {saving
        ? "You are enrolled in a class of this course, so recordings you save here are saved like a student's."
        : "This is what your students see. The recorder, timer and playback all work, but nothing you record here is saved."}{" "}
      <Link href="/teach">Back to my classes</Link>
    </div>
  );
}

const SAMPLE_TRANSCRIPT =
  "Good morning everyone. My name is Sara, and today I am going to talk about solar energy in desert regions. " +
  "Um, first I will look at why deserts suit solar power, then at the cost, and finally at the challenges.";

const SAMPLE_FEEDBACK: FeedbackRow[] = [
  {
    id: "sample-peer",
    source: "peer",
    author_id: "sample-classmate",
    scores: { intro: 3, organization: 3, delivery: 2, language: 3, conclusion: 3 },
    strengths: "Your overview listed three clear sub-themes.",
    improve: "Pause before each new point instead of saying “um”.",
    created_at: "2026-01-01T09:00:00Z",
    author: { full_name: "A classmate" },
  },
];

/**
 * What a saved attempt looks like to a student: the player, timing, the
 * delete or lock, the share list and the feedback. Sample content only; the
 * buttons do nothing.
 */
export function SampleAttempt({ target }: { target: number }) {
  // realistic sample numbers: a little under the target, at a comfortable pace
  const secs = Math.round(target * 0.92);
  const base = metricsOf(SAMPLE_TRANSCRIPT, secs, target);
  const m = { ...base, wpm: 138, words: Math.round((138 * secs) / 60), fillers: 2 };
  return (
    <div className="card" style={{ borderStyle: "dashed" }}>
      <div className="spread">
        <h3>Attempt 1 <span className="tiny muted" style={{ fontWeight: 400 }}>· example</span></h3>
        <span className="pill c5">Attempt 1</span>
      </div>
      <div className="meta">{mmss(secs)} of {mmss(target)} · after a student saves</div>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        Once a student saves, their attempt appears like this, with a player for the recording.
      </p>

      <div className="note" style={{ marginTop: 10 }}>
        <b>{mmss(m.secs)}</b> spoken · target {mmss(m.target)} — <b>{m.timing}</b>
        {m.wpm ? <> · about <b>{m.wpm}</b> words per minute ({paceLabel(m.wpm)})</> : null}
        {m.words ? <> · {m.fillers} filler word{m.fillers === 1 ? "" : "s"}</> : null}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn ghost sm" disabled>Delete attempt 1</button>
        <span className="tiny muted">Attempt 2, once saved, shows a lock instead: it cannot be deleted.</span>
      </div>

      <div className="sep">
        <h3 style={{ fontSize: 14 }}>Share with a classmate</h3>
        <p className="tiny muted" style={{ marginTop: 4 }}>
          Tap <b>Share</b> and this recording appears on their <b>Shared with me</b> page, ready for them to score.
        </p>
        {["Classmate A", "Classmate B"].map((n, i) => (
          <div className="mate" key={n}>
            <b className="small grow">{n}</b>
            <button type="button" className={`btn sm ${i === 0 ? "ghost" : "gold"}`} disabled>
              {i === 0 ? "Shared ✓" : "Share"}
            </button>
          </div>
        ))}
      </div>

      <div className="sep">
        <h3 style={{ fontSize: 14 }}>Feedback</h3>
        <FeedbackList feedback={SAMPLE_FEEDBACK} viewerId="" emptyText="" />
        <button type="button" className="btn gold block" style={{ marginTop: 12 }} disabled>
          Get AI feedback
        </button>
        <p className="tiny muted" style={{ marginTop: 6 }}>
          Unlocks once a classmate or the teacher has scored the attempt. The teacher&rsquo;s official mark appears
          above the feedback.
        </p>
      </div>
    </div>
  );
}
