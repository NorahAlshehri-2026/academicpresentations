"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { RUBRIC } from "@/app/_lib/rubric";

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

/** A classmate's scores and comments on a recording that was shared with them. */
export default function PeerFeedback({
  submissionId,
  authorId,
  existing,
}: {
  submissionId: string;
  authorId: string;
  existing: Existing;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({ ...(existing?.scores ?? {}) });
  const [strengths, setStrengths] = useState(existing?.strengths ?? "");
  const [improve, setImprove] = useState(existing?.improve ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function send() {
    if (!Object.keys(scores).length) {
      setError("Give a score for at least one criterion.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);

    const supabase = browserClient();
    const body = { scores, strengths: strengths.trim() || null, improve: improve.trim() || null };
    const { error: e } = existing
      ? await supabase.from("feedback").update(body).eq("id", existing.id)
      : await supabase.from("feedback").insert({ ...body, submission_id: submissionId, author_id: authorId, source: "peer" });

    setBusy(false);
    if (e) {
      setError(
        e.message.includes("row-level security")
          ? "You cannot score this one. It has not been shared with you, or it is your own recording."
          : e.message
      );
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card">
      <h3>{existing ? "Your feedback" : "Score this recording"}</h3>
      <p className="tiny muted">4 excellent · 3 good · 2 developing · 1 beginning. The descriptor changes as you choose.</p>

      <ScorePicker scores={scores} onPick={(id, n) => setScores({ ...scores, [id]: n })} />

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
