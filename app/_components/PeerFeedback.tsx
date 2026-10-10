"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { RUBRIC } from "@/app/_lib/rubric";
import { objectivesFor, encodeObjectives, decodeObjectives, RATINGS, type Rating } from "@/app/_lib/objectives";

type Existing = {
  id: string;
  scores: Record<string, number> | null;
  strengths: string | null;
  improve: string | null;
} | null;

export function ScorePicker({
  scores,
  onPick,
}: {
  scores: Record<string, number>;
  onPick: (id: string, n: number) => void;
}) {
  return (
    <>
      {RUBRIC.map((c) => {
        const picked = scores[c.id];
        const descriptor =
          picked === 4 ? c.l4 : picked === 3 ? c.l3 : picked === 2 ? c.l2 : picked === 1 ? c.l1 : "Tap a score to see its descriptor.";
        return (
          <div key={c.id}>
            <div className="score-row">
              <span className="nm">{c.n}. {c.name}</span>
              <span className="seg">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" aria-pressed={picked === n} onClick={() => onPick(c.id, n)}>
                    {n}
                  </button>
                ))}
              </span>
            </div>
            <p className="tiny muted" style={{ margin: "-4px 0 8px" }}>{descriptor}</p>
          </div>
        );
      })}
    </>
  );
}

/** Yes / Partly / Not yet for each lesson objective (units 1–4). */
export function ObjectivePicker({
  objectives,
  checks,
  onPick,
}: {
  objectives: string[];
  checks: Record<string, Rating>;
  onPick: (objective: string, r: Rating) => void;
}) {
  return (
    <>
      {objectives.map((o, i) => (
        <div className="score-row" key={o} style={{ flexWrap: "wrap" }}>
          <span className="nm" style={{ minWidth: 200 }}>{i + 1}. {o}</span>
          <span className="seg">
            {RATINGS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={checks[o] === r.id}
                onClick={() => onPick(o, r.id)}
                style={{ width: "auto", padding: "0 10px", fontSize: 12.5 }}
              >
                {r.label}
              </button>
            ))}
          </span>
        </div>
      ))}
    </>
  );
}

/**
 * A classmate's feedback on a recording that was shared with them. In units
 * 1–4 it is checked against the task's lesson objectives plus written
 * comments; the full rubric is used only for the final presentation.
 */
export default function PeerFeedback({
  submissionId,
  authorId,
  existing,
  activityKey,
}: {
  submissionId: string;
  authorId: string;
  existing: Existing;
  activityKey?: string | null;
}) {
  const router = useRouter();
  const objectives = objectivesFor(activityKey);
  const prior = decodeObjectives(existing?.strengths);
  const [scores, setScores] = useState<Record<string, number>>({ ...(existing?.scores ?? {}) });
  const [checks, setChecks] = useState<Record<string, Rating>>(Object.fromEntries(prior.checks));
  const [strengths, setStrengths] = useState(prior.text);
  const [improve, setImprove] = useState(existing?.improve ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function send() {
    if (objectives) {
      if (objectives.some((o) => !checks[o])) {
        setError("Choose Yes, Partly or Not yet for every objective.");
        return;
      }
      if (!strengths.trim() || !improve.trim()) {
        setError("Write both comments: what worked, and one thing to change next time.");
        return;
      }
    } else if (!Object.keys(scores).length) {
      setError("Give a score for at least one criterion.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);

    const supabase = browserClient();
    const body = objectives
      ? {
          scores: null,
          strengths: encodeObjectives(objectives.map((o) => [o, checks[o]] as [string, Rating]), strengths),
          improve: improve.trim() || null,
        }
      : { scores, strengths: strengths.trim() || null, improve: improve.trim() || null };
    const write = (b: typeof body) =>
      existing
        ? supabase.from("feedback").update(b).eq("id", existing.id)
        : supabase.from("feedback").insert({ ...b, submission_id: submissionId, author_id: authorId, source: "peer" });
    let { error: e } = await write(body);
    // if the database insists on a scores value, an empty set means "not scored"
    if (e && objectives && /scores|null value|check constraint/i.test(e.message)) {
      ({ error: e } = await write({ ...body, scores: {} as any }));
    }

    setBusy(false);
    if (e) {
      setError(
        e.message.includes("row-level security")
          ? "You cannot give feedback on this one. It has not been shared with you, or it is your own recording."
          : e.message
      );
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card">
      <h3>{existing ? "Your feedback" : objectives ? "Give feedback" : "Score this recording"}</h3>

      {objectives ? (
        <>
          <p className="tiny muted">Check the speaker against this lesson&rsquo;s objectives, then write your comments.</p>
          <ObjectivePicker objectives={objectives} checks={checks} onPick={(o, r) => setChecks({ ...checks, [o]: r })} />
        </>
      ) : (
        <>
          <p className="tiny muted">4 excellent · 3 good · 2 developing · 1 beginning. The descriptor changes as you choose.</p>
          <ScorePicker scores={scores} onPick={(id, n) => setScores({ ...scores, [id]: n })} />
        </>
      )}

      <label className="fld" htmlFor={`s-${submissionId}`}>What worked</label>
      <textarea
        id={`s-${submissionId}`}
        value={strengths}
        onChange={(e) => setStrengths(e.target.value)}
        placeholder="Name the moment, not a feeling: “your overview listed three sub-themes clearly”"
      />

      <label className="fld" htmlFor={`i-${submissionId}`}>What to change next time</label>
      <textarea
        id={`i-${submissionId}`}
        value={improve}
        onChange={(e) => setImprove(e.target.value)}
        placeholder="One concrete action: “pause before each linking phrase”"
      />

      <button className="btn gold block" style={{ marginTop: 14 }} onClick={send} disabled={busy}>
        {busy ? "Sending…" : existing ? "Update my feedback" : "Send feedback"}
      </button>

      {saved && <div className="ok" style={{ marginTop: 12 }}>Saved. Your classmate can see it now.</div>}
      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
