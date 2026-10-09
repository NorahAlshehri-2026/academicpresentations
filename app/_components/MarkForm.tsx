"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { RUBRIC } from "@/app/_lib/rubric";
import { ScorePicker } from "./PeerFeedback";

type Existing = {
  id: string;
  scores: Record<string, number> | null;
  strengths: string | null;
  improve: string | null;
} | null;

/**
 * The teacher's feedback and official mark in one form. The five scores make
 * the mark out of 20, which goes into the gradebook; the comments go to the
 * student with it. Changing a mark keeps the old one in the history and asks
 * for a reason, which the database insists on.
 */
export default function MarkForm({
  submissionId,
  markerId,
  existing,
  alreadyMarked,
}: {
  submissionId: string;
  markerId: string;
  existing: Existing;
  alreadyMarked: number | null;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({ ...(existing?.scores ?? {}) });
  const [strengths, setStrengths] = useState(existing?.strengths ?? "");
  const [improve, setImprove] = useState(existing?.improve ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const complete = RUBRIC.every((c) => scores[c.id]);
  const total = RUBRIC.reduce((a, c) => a + (scores[c.id] ?? 0), 0);

  async function save() {
    if (!complete) {
      setError("Score all five criteria to give a mark out of 20.");
      return;
    }
    if (alreadyMarked !== null && alreadyMarked !== total && !reason.trim()) {
      setError("This attempt already has a mark of " + alreadyMarked + "/20. Say why you are changing it.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const supabase = browserClient();

    const body = { scores, strengths: strengths.trim() || null, improve: improve.trim() || null };
    const fb = existing
      ? await supabase.from("feedback").update(body).eq("id", existing.id)
      : await supabase.from("feedback").insert({ ...body, submission_id: submissionId, author_id: markerId, source: "teacher" });

    if (fb.error) {
      setBusy(false);
      setError(fb.error.message);
      return;
    }

    if (alreadyMarked === null || alreadyMarked !== total || reason.trim()) {
      const comment = [strengths.trim(), improve.trim() && `Next time: ${improve.trim()}`].filter(Boolean).join(" ");
      const { error: g } = await supabase.from("grades").insert({
        submission_id: submissionId,
        marker_id: markerId,
        total,
        per_criterion: scores,
        comment: comment || null,
        reason: alreadyMarked !== null ? reason.trim() : null,
      });
      if (g) {
        setBusy(false);
        setError(g.message.includes("requires a reason") ? "Say why you are changing the mark." : g.message);
        return;
      }
    }

    setBusy(false);
    setSaved(true);
    setReason("");
    router.refresh();
  }

  return (
    <div className="card">
      <div className="spread">
        <h3>{alreadyMarked !== null ? "Change the mark" : "Mark this attempt"}</h3>
        <span className="total">
          {complete ? total : "–"}
          <span className="small muted">/20</span>
        </span>
      </div>
      <p className="tiny muted">
        Score all five criteria. The total goes into the gradebook; the comments go to the student.
      </p>

      <ScorePicker scores={scores} onPick={(id, n) => setScores({ ...scores, [id]: n })} />

      <label className="fld" htmlFor={`ms-${submissionId}`}>What worked</label>
      <textarea id={`ms-${submissionId}`} value={strengths} onChange={(e) => setStrengths(e.target.value)} />

      <label className="fld" htmlFor={`mi-${submissionId}`}>What to change next time</label>
      <textarea id={`mi-${submissionId}`} value={improve} onChange={(e) => setImprove(e.target.value)} />

      {alreadyMarked !== null && (
        <>
          <label className="fld" htmlFor={`mr-${submissionId}`}>
            Reason for changing the mark (needed only if the total changes from {alreadyMarked})
          </label>
          <input
            id={`mr-${submissionId}`}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. second listen after the student's query"
          />
        </>
      )}

      <button className="btn gold block" style={{ marginTop: 14 }} onClick={save} disabled={busy}>
        {busy ? "Saving…" : alreadyMarked !== null ? "Save the new mark" : `Save mark${complete ? ` · ${total}/20` : ""}`}
      </button>

      {saved && <div className="ok" style={{ marginTop: 12 }}>Saved to the gradebook.</div>}
      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
