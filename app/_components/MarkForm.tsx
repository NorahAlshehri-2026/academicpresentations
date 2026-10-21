"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { RUBRIC } from "@/app/_lib/rubric";
import { ScorePicker, ObjectivePicker } from "./PeerFeedback";
import { objectivesFor, objectivesTotal, encodeObjectives, decodeObjectives, type Rating } from "@/app/_lib/objectives";

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
 *
 * In units 1–4 the teacher checks the task's lesson objectives instead, and
 * the mark out of 20 is worked out from them automatically (Yes = full credit,
 * Partly = half, Not yet = none). The final presentation uses the rubric.
 *
 * Either way the teacher or an administrator can also type the mark in by hand
 * (a whole number from 0 to 20), which overrides the worked-out mark. A hand
 * mark can be saved even if not every criterion or objective is filled in.
 */
export default function MarkForm({
  submissionId,
  markerId,
  existing,
  alreadyMarked,
  activityKey,
}: {
  submissionId: string;
  markerId: string;
  existing: Existing;
  alreadyMarked: number | null;
  activityKey?: string | null;
}) {
  const router = useRouter();
  const objectives = objectivesFor(activityKey);
  const prior = decodeObjectives(existing?.strengths);
  const [scores, setScores] = useState<Record<string, number>>({ ...(existing?.scores ?? {}) });
  const [checks, setChecks] = useState<Record<string, Rating>>(Object.fromEntries(prior.checks));
  const [strengths, setStrengths] = useState(prior.text);
  const [improve, setImprove] = useState(existing?.improve ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const filled = objectives ? objectives.every((o) => checks[o]) : RUBRIC.every((c) => scores[c.id]);
  const worked = objectives
    ? objectivesTotal(objectives.map((o) => checks[o]))
    : RUBRIC.reduce((a, c) => a + (scores[c.id] ?? 0), 0);

  // A mark already saved that differs from what the scores give was entered by hand.
  const initialWorked = objectives
    ? objectivesTotal(objectives.map((o) => Object.fromEntries(prior.checks)[o]))
    : RUBRIC.reduce((a, c) => a + (Number(existing?.scores?.[c.id]) || 0), 0);
  const [manual, setManual] = useState(alreadyMarked !== null && alreadyMarked !== initialWorked);
  const [manualMark, setManualMark] = useState(alreadyMarked !== null ? String(alreadyMarked) : "");
  const manualValue = manualMark.trim() === "" ? NaN : Number(manualMark);
  const manualOk = Number.isInteger(manualValue) && manualValue >= 0 && manualValue <= 20;

  const complete = manual ? manualOk : filled;
  const total = manual ? (manualOk ? manualValue : 0) : worked;

  async function save() {
    if (!complete) {
      setError(
        manual
          ? "Type a whole-number mark from 0 to 20."
          : objectives
            ? "Choose Yes, Partly or Not yet for every objective, or enter the mark by hand."
            : "Score all five criteria to give a mark out of 20, or enter the mark by hand."
      );
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

    const body = objectives
      ? {
          scores: null as any,
          strengths: encodeObjectives(
            objectives.filter((o) => checks[o]).map((o) => [o, checks[o]] as [string, Rating]),
            strengths
          ),
          improve: improve.trim() || null,
        }
      : { scores, strengths: strengths.trim() || null, improve: improve.trim() || null };
    const writeFb = (b: typeof body) =>
      existing
        ? supabase.from("feedback").update(b).eq("id", existing.id)
        : supabase.from("feedback").insert({ ...b, submission_id: submissionId, author_id: markerId, source: "teacher" });
    let fb = await writeFb(body);
    // if the database insists on a scores value, an empty set means "not scored"
    if (fb.error && objectives && /scores|null value|check constraint/i.test(fb.error.message)) {
      fb = await writeFb({ ...body, scores: {} });
    }

    if (fb.error) {
      setBusy(false);
      setError(fb.error.message);
      return;
    }

    if (alreadyMarked === null || alreadyMarked !== total || reason.trim()) {
      const comment = [strengths.trim(), improve.trim() && `Next time: ${improve.trim()}`].filter(Boolean).join(" ");
      const grade = {
        submission_id: submissionId,
        marker_id: markerId,
        total,
        per_criterion: (objectives || !filled ? null : scores) as Record<string, number> | null,
        comment: comment || null,
        reason: alreadyMarked !== null ? reason.trim() : null,
      };
      let { error: g } = await supabase.from("grades").insert(grade);
      if (g && grade.per_criterion === null && /per_criterion|null value|check constraint/i.test(g.message)) {
        ({ error: g } = await supabase.from("grades").insert({ ...grade, per_criterion: {} }));
      }
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
      {objectives ? (
        <>
          <p className="tiny muted">
            Check each lesson objective. The mark is worked out automatically (Yes = full credit, Partly = half,
            Not yet = none) and goes into the gradebook; the comments go to the student.
          </p>
          <ObjectivePicker objectives={objectives} checks={checks} onPick={(o, r) => setChecks({ ...checks, [o]: r })} />
        </>
      ) : (
        <>
          <p className="tiny muted">
            Score all five criteria. The total goes into the gradebook; the comments go to the student.
          </p>
          <ScorePicker scores={scores} onPick={(id, n) => setScores({ ...scores, [id]: n })} />
        </>
      )}

      <div className="note" style={{ marginTop: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={manual}
            onChange={(e) => {
              setManual(e.target.checked);
              if (e.target.checked && manualMark.trim() === "" && filled) setManualMark(String(worked));
              setError(null);
            }}
          />
          Enter the mark by hand
        </label>
        {manual ? (
          <div className="row" style={{ marginTop: 8, gap: 8, alignItems: "center" }}>
            <input
              id={`mm-${submissionId}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              step={1}
              value={manualMark}
              onChange={(e) => setManualMark(e.target.value)}
              aria-label="Mark out of 20"
              style={{ width: 90 }}
            />
            <span className="small muted">
              / 20{filled ? ` · the ${objectives ? "objectives" : "scores"} above give ${worked}` : ""}
            </span>
          </div>
        ) : (
          <p className="tiny muted" style={{ margin: "6px 0 0" }}>
            Tick this to type a mark from 0 to 20 yourself. It replaces the worked-out mark in the gradebook.
          </p>
        )}
      </div>

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
