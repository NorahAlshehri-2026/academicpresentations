"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { VIDEO_MAX_MB, VIDEO_TYPES, megabytes, videoExt } from "@/app/_lib/staff-video-types";

function explain(message: string) {
  const m = message.toLowerCase();
  if (m.includes("maximum allowed size") || m.includes("payload too large") || m.includes("exceeded"))
    return `The video is larger than storage allows. Make it smaller (see the tip below), or raise the file size limit in Supabase → Storage → Settings on a paid plan.`;
  if (m.includes("mime") || m.includes("content type"))
    return 'The "media" storage bucket does not accept this type of file. In Supabase → Storage → media → Edit bucket, clear "Allowed MIME types", then upload again.';
  if (m.includes("quota") || m.includes("storage limit"))
    return "The academy's storage is full. Delete videos you no longer need, or upgrade the Supabase plan.";
  return message;
}

/** Sends the file straight to storage, reporting how much has gone. */
function sendFile(url: string, file: File, type: string, onProgress: (sent: number) => void): Promise<{ ok: boolean; message: string; network: boolean }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", type);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true, message: "", network: false });
      let message = `Upload failed (${xhr.status}).`;
      try {
        const out = JSON.parse(xhr.responseText);
        message = out.message || out.error || message;
      } catch {}
      resolve({ ok: false, message, network: false });
    };
    xhr.onerror = () => resolve({ ok: false, message: "The upload was interrupted. Check your connection and try again.", network: true });
    xhr.send(file);
  });
}

/**
 * Administrators add a teacher video to a course. Only that course's teachers
 * and administrators will see it under Teacher videos.
 */
export default function StaffVideoUpload({ courses }: { courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // leaving the page stops an upload part-way
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  function choose(f: File | undefined) {
    setMsg(null);
    if (!f) return;
    if (!VIDEO_TYPES[videoExt(f.name)]) {
      setFile(null);
      setMsg({ ok: false, text: "Choose an MP4, WebM or MOV video file." });
      return;
    }
    if (f.size > VIDEO_MAX_MB * 1024 * 1024) {
      setFile(null);
      setMsg({ ok: false, text: `That video is ${megabytes(f.size)}. The limit is ${VIDEO_MAX_MB} MB a video, so it needs to be made smaller first (see the tip below).` });
      return;
    }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
  }

  async function post(body: object) {
    const res = await fetch("/api/staff-videos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    return { ok: res.ok, out };
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    if (!title.trim()) {
      setMsg({ ok: false, text: "Give the video a title." });
      return;
    }
    setBusy(true);
    setMsg(null);
    setSent(0);
    try {
      const start = await post({ step: "start", courseId, name: file.name, size: file.size });
      if (!start.ok) throw new Error(start.out.error ?? "The upload could not be started.");
      const { id, file: stored, path, token, url, type } = start.out;

      let result = await sendFile(url, file, type, setSent);
      if (!result.ok && result.network) {
        // some networks block the direct upload; try once more the standard way
        const { error } = await browserClient().storage.from("media").uploadToSignedUrl(path, token, file, { contentType: type, upsert: false });
        result = error ? { ok: false, message: error.message, network: false } : { ok: true, message: "", network: false };
        if (result.ok) setSent(file.size);
      }
      if (!result.ok) throw new Error(explain(result.message));

      const finish = await post({ step: "finish", courseId, id, file: stored, title, note });
      if (!finish.ok) throw new Error(finish.out.error ?? "The video could not be added to the list.");

      setMsg({ ok: true, text: `Added “${title.trim()}”. Its course's teachers can watch it now.` });
      setFile(null);
      setTitle("");
      setNote("");
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || "That did not work. Please try again." });
    }
    setBusy(false);
  }

  const pct = file ? Math.min(100, Math.round((sent / Math.max(1, file.size)) * 100)) : 0;

  return (
    <div className="card">
      <h3>Add a video</h3>
      <p className="small muted" style={{ margin: "4px 0 0" }}>
        MP4, WebM or MOV, up to {VIDEO_MAX_MB} MB each. Only the teachers of the course you choose, and administrators, will
        see it.
      </p>
      <form onSubmit={upload}>
        {courses.length > 1 ? (
          <>
            <label className="fld" htmlFor="sv-course">Course</label>
            <select id="sv-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={busy}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </>
        ) : null}

        <label className="fld" htmlFor="sv-file">Video file</label>
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={() => input.current?.click()} disabled={busy}>
            {file ? "Choose a different file" : "Choose a video"}
          </button>
          {file && (
            <span className="small">
              {file.name} · {megabytes(file.size)}
            </span>
          )}
        </div>
        <input
          ref={input}
          id="sv-file"
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov"
          hidden
          onChange={(e) => choose(e.target.files?.[0])}
        />

        <label className="fld" htmlFor="sv-title">Title</label>
        <input id="sv-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} disabled={busy} placeholder="e.g. Unit 3: modelling an oral citation" />

        <label className="fld" htmlFor="sv-note">Note for teachers (optional)</label>
        <textarea id="sv-note" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} disabled={busy} placeholder="When to use it, which exercise it goes with…" />

        {busy && (
          <div className="sv-progress" aria-live="polite">
            <div className="sv-bar"><i style={{ width: `${pct}%` }} /></div>
            <span className="tiny muted">
              Uploading… {pct}% of {file ? megabytes(file.size) : ""}. Keep this page open until it finishes.
            </span>
          </div>
        )}

        <div className="row" style={{ marginTop: 14 }}>
          <button type="submit" className="btn gold" disabled={!file || busy}>
            {busy ? "Uploading…" : "Upload the video"}
          </button>
        </div>
      </form>
      {msg && (
        <div className={msg.ok ? "note" : "err"} style={{ marginTop: 12 }}>
          {msg.text}
        </div>
      )}
      <p className="tiny muted" style={{ marginTop: 12 }}>
        <b>Too big?</b> Export it at 720p from your phone or editor, or shrink it with the free HandBrake app (“Fast 720p30”
        preset). As a rough guide, a minute of 720p video takes 6–10 MB, so split long videos into parts.
      </p>
    </div>
  );
}
