"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SOURCE_NAMES, clipName, megabytes, type VideoSetShown } from "@/app/_lib/staff-video-types";

/**
 * The teacher who added a recorded lecture, or an administrator, renames it,
 * labels and reorders its videos, removes a video, or deletes the lecture.
 */
export default function StaffVideoActions({ courseId, set, onClose }: { courseId: string; set: VideoSetShown; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(set.title);
  const [note, setNote] = useState(set.note);
  const [labels, setLabels] = useState<Record<string, string>>(() => Object.fromEntries(set.clips.map((c) => [c.id, c.label])));
  const [order, setOrder] = useState(() => set.clips.map((c) => c.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // a video removed a moment ago drops out; anything new goes at the end
  const byId = new Map(set.clips.map((c) => [c.id, c]));
  const ids = [...order.filter((id) => byId.has(id)), ...set.clips.map((c) => c.id).filter((id) => !order.includes(id))];

  async function send(method: "PATCH" | "DELETE", body: object) {
    setBusy(true);
    setError(null);
    let ok = false;
    try {
      const res = await fetch("/api/staff-videos", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, setId: set.id, ...body }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) setError(out.error ?? "That did not work. Please try again.");
      else {
        ok = true;
        router.refresh();
      }
    } catch {
      setError("The site could not be reached. Check your connection and try again.");
    }
    setBusy(false);
    return ok;
  }

  function move(i: number, by: -1 | 1) {
    const next = [...ids];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setOrder(next);
  }

  async function removeClip(id: string, i: number) {
    const name = clipName({ label: labels[id] }, i);
    const last = ids.length === 1;
    const sure = window.confirm(
      last
        ? `Remove “${name}”? It is the only video in “${set.title}”, so the lecture is deleted too.`
        : `Remove “${name}” from “${set.title}”?${byId.get(id)?.kind === "file" ? " The file is deleted for good." : ""}`
    );
    if (!sure) return;
    if ((await send("DELETE", { clipId: id })) && last) onClose();
  }

  async function removeSet() {
    const files = set.clips.some((c) => c.kind === "file");
    if (!window.confirm(`Delete “${set.title}” and its ${set.clips.length === 1 ? "video" : `${set.clips.length} videos`}? Teachers will no longer see ${set.clips.length === 1 ? "it" : "them"}${files ? ", and uploaded files are deleted for good" : ""}.`)) return;
    if (await send("DELETE", {})) onClose();
  }

  return (
    <form
      className="sv-edit"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await send("PATCH", { title, note, labels, order: ids })) onClose();
      }}
    >
      <label className="fld" htmlFor={`t-${set.id}`}>Lecture title</label>
      <input id={`t-${set.id}`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
      <label className="fld" htmlFor={`n-${set.id}`}>Note for teachers</label>
      <textarea id={`n-${set.id}`} rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} disabled={busy} />

      <div className="fld" style={{ marginTop: 16 }}>Videos, in the order they play</div>
      {ids.map((id, i) => {
        const c = byId.get(id)!;
        return (
          <div className="sv-erow" key={id}>
            <b className="sv-n">{i + 1}</b>
            <div className="grow">
              <input
                aria-label={`Label for video ${i + 1}`}
                value={labels[id] ?? ""}
                maxLength={80}
                placeholder={`Video ${i + 1}`}
                onChange={(e) => setLabels((l) => ({ ...l, [id]: e.target.value }))}
                disabled={busy}
              />
              <span className="tiny muted">{c.kind === "file" ? `Uploaded file · ${megabytes(c.size)}` : SOURCE_NAMES[c.source]}</span>
            </div>
            <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
              <button type="button" className="sv-icon" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={`Move video ${i + 1} up`}>↑</button>
              <button type="button" className="sv-icon" onClick={() => move(i, 1)} disabled={busy || i === ids.length - 1} aria-label={`Move video ${i + 1} down`}>↓</button>
              <button type="button" className="sv-x" onClick={() => removeClip(id, i)} disabled={busy}>Remove</button>
            </div>
          </div>
        );
      })}

      <div className="row" style={{ marginTop: 14 }}>
        <button type="submit" className="btn sm" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save changes"}</button>
        <button type="button" className="btn ghost sm" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn ghost sm sv-danger" onClick={removeSet} disabled={busy} style={{ marginLeft: "auto" }}>
          Delete this lecture
        </button>
      </div>
      {error && <div className="err" style={{ marginTop: 8 }}>{error}</div>}
    </form>
  );
}
