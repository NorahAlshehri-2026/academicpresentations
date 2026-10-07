"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { RUBRIC } from "@/app/_lib/rubric";

export default function PeerFeedback({
  submissionId,
  authorId,
  source,
}: {
  submissionId: string;
  authorId: string;
  source: "peer" | "teacher";
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [improve, setImprove] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!Object.keys(scores).length) {
      setError("Give a score for at least one criterion.");
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = browserClient();
    const { error: e } = await supabase.from("feedback").insert({
      submission_id: submissionId,
      author_id: authorId,
      source,
      scores,
      strengths: strengths.trim() || null,
      improve: improve.trim() || null,
    });

    if (e) {
      setBusy(false);
      setError(
        e.message.includes("row-level security")
          ? "You cannot score this one — either it is your own recording, or you are not in that section."
          : e.message
      );
      return;
    }

    setScores({});
    setStrengths("");
    setImprove("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card">
      <h3>{source === "teacher" ? "Mark this attempt" : "Score your partner"}</h3>
      <p className="tiny muted">
        4 excellent · 3 good · 2 developing · 1 beginning. The descriptor changes as you choose.
      </p>

      {RUBRIC.map((c) => {
        const picked = scores[c.id];
        const descriptor = picked === 4 ? c.l4 : picked === 3 ? c.l3 : picked === 2 ? c.l2 : picked === 1 ? c.l1 : c.l3;
        return (
          <div key={c.id}>
            <div className="score-row">
              <span className="nm">{c.n}. {c.name}</span>
              <span className="seg">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={picked === n}
                    onClick={() => setScores({ ...scores, [c.id]: n })}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </div>
            <p className="tiny muted" style={{ margin: "-4px 0 8px" }}>{descriptor}</p>
          </div>
        );
      })}

      <label className="fld" htmlFor={`s-${submissionId}`}>What worked</label>
      <textarea
        id={`s-${submissionId}`}
        value={strengths}
        onChange={(e) => setStrengths(e.target.value)}
        placeholder="Name the moment, not a feeling — &ldquo;your overview listed three sub-themes clearly&rdquo;"
      />

      <label className="fld" htmlFor={`i-${submissionId}`}>What to change next time</label>
      <textarea
        id={`i-${submissionId}`}
        value={improve}
        onChange={(e) => setImprove(e.target.value)}
        placeholder="One concrete action — &ldquo;pause before each linking phrase&rdquo;"
      />

      <button className="btn block" style={{ marginTop: 14 }} onClick={send} disabled={busy}>
        {busy ? "Sending…" : "Send feedback"}
      </button>

      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
