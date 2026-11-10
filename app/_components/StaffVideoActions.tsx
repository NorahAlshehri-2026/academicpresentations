"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** The teacher who added a video, or an administrator, renames or deletes it. */
export default function StaffVideoActions({ courseId, id, title, note }: { courseId: string; id: string; title: string; note: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(title);
  const [n, setN] = useState(note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PATCH" | "DELETE", body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff-videos", { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId, id, ...body }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) setError(out.error ?? "That did not work. Please try again.");
      else {
        setEditing(false);
        router.refresh();
      }
    } catch {
      setError("The site could not be reached. Check your connection and try again.");
    }
    setBusy(false);
  }

  function remove() {
    if (!window.confirm(`Delete “${title}”? Teachers will no longer see it, and the file is deleted for good.`)) return;
    send("DELETE", {});
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send("PATCH", { title: t, note: n });
        }}
        style={{ marginTop: 10 }}
      >
        <label className="fld" htmlFor={`t-${id}`}>Title</label>
        <input id={`t-${id}`} value={t} maxLength={120} onChange={(e) => setT(e.target.value)} disabled={busy} />
        <label className="fld" htmlFor={`n-${id}`}>Note for teachers</label>
        <textarea id={`n-${id}`} rows={2} value={n} maxLength={500} onChange={(e) => setN(e.target.value)} disabled={busy} />
        <div className="row" style={{ marginTop: 10 }}>
          <button type="submit" className="btn sm" disabled={busy || !t.trim()}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="btn ghost sm" onClick={() => { setEditing(false); setT(title); setN(note); setError(null); }} disabled={busy}>
            Cancel
          </button>
        </div>
        {error && <div className="err" style={{ marginTop: 8 }}>{error}</div>}
      </form>
    );
  }

  return (
    <>
      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="btn ghost sm" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
        <button type="button" className="btn ghost sm" onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
      </div>
      {error && <div className="err" style={{ marginTop: 8 }}>{error}</div>}
    </>
  );
}
