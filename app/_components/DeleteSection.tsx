"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Deletes a whole class. To guard against a slip, the button stays off until
 * the section number is typed exactly.
 */
export default function DeleteSection({
  sectionId,
  sectionNumber,
  students,
  attempts,
  marks,
  canDelete,
  after,
}: {
  sectionId: string;
  sectionNumber: string;
  students: number;
  attempts: number;
  marks: number;
  /** false for a teacher whose class already has official marks */
  canDelete: boolean;
  after: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const matches = typed.trim() === String(sectionNumber).trim();

  async function remove() {
    if (!matches) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sections/${sectionId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "That could not be done.");
      return;
    }
    router.push(after);
    router.refresh();
  }

  return (
    <div className="card" style={{ borderTopColor: "var(--red)" }}>
      <h3 style={{ color: "var(--red)" }}>Delete this class</h3>
      {!canDelete ? (
        <p className="small muted">
          This class has official marks, so only an administrator can delete it.
        </p>
      ) : !open ? (
        <>
          <p className="small muted">
            Removes Section {sectionNumber} for good, with its student list and everything recorded in it.
          </p>
          <button type="button" className="btn ghost sm" style={{ marginTop: 10, color: "var(--red)" }} onClick={() => setOpen(true)}>
            Delete class…
          </button>
        </>
      ) : (
        <>
          <div className="err">
            This deletes <b>Section {sectionNumber}</b> and cannot be undone:
            {" "}{plural(students, "student")} will leave it, and{" "}
            {plural(attempts, "recorded attempt")}
            {marks > 0 ? <>, {plural(marks, "official mark")}</> : null} and all their feedback will be deleted.
            Student accounts are kept.
          </div>
          <label className="fld" htmlFor="del-confirm">
            Type the section number, <b>{sectionNumber}</b>, to confirm
          </label>
          <input
            id="del-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            inputMode="text"
          />
          {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}
          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn rec sm"
              onClick={remove}
              disabled={!matches || busy}
            >
              {busy ? "Deleting…" : `Delete Section ${sectionNumber}`}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => { setOpen(false); setTyped(""); setError(null); }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
