"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import {
  MAX_CLIPS,
  MAX_SETS,
  SOURCE_NAMES,
  VIDEO_MAX_MB,
  VIDEO_TYPES,
  megabytes,
  parseVideoLink,
  videoExt,
} from "@/app/_lib/staff-video-types";

function explain(message: string) {
  const m = message.toLowerCase();
  if (m.includes("maximum allowed size") || m.includes("payload too large") || m.includes("exceeded"))
    return `The video is larger than storage allows (${VIDEO_MAX_MB} MB a file). Add it as a link instead: YouTube (Unlisted) or Google Drive.`;
  if (m.includes("mime") || m.includes("content type"))
    return 'The "media" storage bucket does not accept this type of file. In Supabase → Storage → media → Edit bucket, clear "Allowed MIME types", then upload again.';
  if (m.includes("quota") || m.includes("storage limit"))
    return "The academy's storage is full. Delete videos you no longer need, or add new ones as links.";
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

type Slot = { key: number; mode: "file" | "link"; file: File | null; url: string; label: string; error: string };
const blank = (key: number): Slot => ({ key, mode: "file", file: null, url: "", label: "", error: "" });

/**
 * Teachers (for the courses they teach) and administrators (for any course)
 * add a recorded lecture with up to three videos, or (into) add more videos to
 * a lecture that has room. A course holds up to six lectures. Each video is a file (up to the storage limit) or a
 * link to a bigger video on YouTube, Google Drive, Vimeo or OneDrive. Only
 * that course's teachers and administrators see it; students never do.
 */
export default function StaffVideoUpload({
  courses,
  isAdmin = false,
  into,
  onDone,
}: {
  /** lectures: how many recorded lectures the course has now */
  courses: { id: string; title: string; lectures?: number }[];
  isAdmin?: boolean;
  into?: { courseId: string; setId: string; title: string; room: number };
  onDone?: () => void;
}) {
  const router = useRouter();
  const next = useRef(1);
  const isFull = (c: { lectures?: number }) => (c.lectures ?? 0) >= MAX_SETS;
  const open = courses.filter((c) => !isFull(c));
  const [courseId, setCourseId] = useState(into?.courseId ?? open[0]?.id ?? courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [slots, setSlots] = useState<Slot[]>([blank(0)]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [sent, setSent] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const room = into ? into.room : MAX_CLIPS;
  const total = slots.reduce((n, s) => n + (s.mode === "file" && s.file ? s.file.size : 0), 0);

  // once a course fills up, the form moves on to one that still has room
  useEffect(() => {
    if (into) return;
    const now = courses.find((c) => c.id === courseId);
    if ((!now || isFull(now)) && open[0] && open[0].id !== courseId) setCourseId(open[0].id);
  }, [courses, courseId, into, open]);

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

  const change = (key: number, patch: Partial<Slot>) =>
    setSlots((all) => all.map((s) => (s.key === key ? { ...s, error: "", ...patch } : s)));

  function choose(key: number, f: File | undefined) {
    setMsg(null);
    if (!f) return;
    if (!VIDEO_TYPES[videoExt(f.name)]) return change(key, { file: null, error: "Choose an MP4, WebM or MOV video file." });
    if (f.size > VIDEO_MAX_MB * 1024 * 1024) {
      return change(key, {
        file: null,
        error: `That video is ${megabytes(f.size)}; files can be up to ${VIDEO_MAX_MB} MB. Put it on YouTube (Unlisted) or Google Drive and paste the link instead.`,
      });
    }
    change(key, { file: f });
    if (!into && !title.trim() && slots.length === 1) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
  }

  async function post(body: object) {
    const res = await fetch("/api/staff-videos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    return { ok: res.ok, out };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    if (!into && !title.trim()) return setMsg({ ok: false, text: "Give the lecture a title." });

    // check every video before anything is uploaded
    const checked = slots.map((s) => {
      if (s.mode === "file" && !s.file) return { ...s, error: "Choose a video file, paste a link, or remove this video." };
      if (s.mode === "link") {
        const link = parseVideoLink(s.url);
        if ("error" in link) return { ...s, error: link.error };
      }
      return s;
    });
    if (checked.some((s) => s.error)) {
      setSlots(checked);
      return setMsg({ ok: false, text: "Check the videos marked below." });
    }

    setBusy(true);
    setSent(0);
    const uploaded: string[] = [];
    const clips: object[] = [];
    let done = 0;
    try {
      for (const [i, s] of slots.entries()) {
        if (s.mode === "link") {
          clips.push({ kind: "link", url: s.url, label: s.label });
          continue;
        }
        const file = s.file!;
        setStage(slots.length > 1 ? `Uploading video ${i + 1} of ${slots.length}…` : "Uploading…");
        const start = await post({ step: "start", courseId, setId: into?.setId, name: file.name, size: file.size });
        if (!start.ok) throw new Error((slots.length > 1 ? `Video ${i + 1}: ` : "") + (start.out.error ?? "the upload could not be started."));
        const { id, file: stored, path, token, url, type } = start.out;

        let result = await sendFile(url, file, type, (n) => setSent(done + n));
        if (!result.ok && result.network) {
          // some networks block the direct upload; try once more the standard way
          const { error } = await browserClient().storage.from("media").uploadToSignedUrl(path, token, file, { contentType: type, upsert: false });
          result = error ? { ok: false, message: error.message, network: false } : { ok: true, message: "", network: false };
        }
        if (!result.ok) throw new Error((slots.length > 1 ? `Video ${i + 1}: ` : "") + explain(result.message));
        done += file.size;
        setSent(done);
        uploaded.push(stored);
        clips.push({ kind: "file", id, file: stored, label: s.label });
      }

      setStage("Saving…");
      const finish = await post({ step: "save", courseId, setId: into?.setId, title, note, clips });
      if (!finish.ok) throw new Error(finish.out.error ?? "The videos could not be added to the list.");

      const n = clips.length;
      setMsg({
        ok: true,
        text: into
          ? `Added ${n} video${n === 1 ? "" : "s"} to “${into.title}”.`
          : `Added “${title.trim()}” with ${n} video${n === 1 ? "" : "s"}. The course's teachers and administrators can watch ${n === 1 ? "it" : "them"} now.`,
      });
      setTitle("");
      setNote("");
      setSlots([blank(next.current++)]);
      router.refresh();
      onDone?.();
    } catch (err: any) {
      if (uploaded.length) post({ step: "discard", courseId, files: uploaded }).catch(() => {});
      setMsg({ ok: false, text: err?.message || "That did not work. Please try again." });
    }
    setStage("");
    setBusy(false);
  }

  const pct = total ? Math.min(100, Math.round((sent / total) * 100)) : 0;
  const slotsLeft = room - slots.length;

  const form = (
    <form onSubmit={save}>
      {!into && (
        <>
          {courses.length > 1 ? (
            <>
              <label className="fld" htmlFor="sv-course">Course</label>
              <select id="sv-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={busy}>
                {courses.map((c) => (
                  <option key={c.id} value={c.id} disabled={isFull(c)}>
                    {c.title} ({c.lectures ?? 0} of {MAX_SETS} lectures{isFull(c) ? ", full" : ""})
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <label className="fld" htmlFor="sv-title">Lecture title</label>
          <input id="sv-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} disabled={busy} placeholder="e.g. Lecture 3: citing sources out loud" />

          <label className="fld" htmlFor="sv-note">Note for teachers (optional)</label>
          <textarea id="sv-note" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} disabled={busy} placeholder="When to use it, which exercise it goes with…" />

          <div className="fld" style={{ marginTop: 16 }}>Videos in this lecture <span className="muted" style={{ fontWeight: 400 }}>(up to {MAX_CLIPS})</span></div>
        </>
      )}

      {slots.map((s, i) => {
        const link = s.mode === "link" && s.url.trim() ? parseVideoLink(s.url) : null;
        return (
          <fieldset className="sv-slot" key={s.key} disabled={busy} aria-label={`Video ${i + 1}`}>
            <div className="spread">
              <span className="sv-slot-n">Video {i + 1}</span>
              {slots.length > 1 && (
                <button type="button" className="sv-x" onClick={() => setSlots((all) => all.filter((x) => x.key !== s.key))} aria-label={`Remove video ${i + 1}`}>
                  Remove
                </button>
              )}
            </div>

            <div className="sv-mode" role="group" aria-label={`How to add video ${i + 1}`}>
              <button type="button" aria-pressed={s.mode === "file"} onClick={() => change(s.key, { mode: "file" })}>Upload a file</button>
              <button type="button" aria-pressed={s.mode === "link"} onClick={() => change(s.key, { mode: "link" })}>Paste a link</button>
            </div>

            {s.mode === "file" ? (
              <div className="row" style={{ marginTop: 10 }}>
                <label className="btn ghost sm" htmlFor={`sv-file-${s.key}`} style={{ cursor: "pointer" }}>
                  {s.file ? "Choose a different file" : "Choose a video"}
                </label>
                <span className="small">
                  {s.file ? `${s.file.name} · ${megabytes(s.file.size)}` : <span className="muted">MP4, WebM or MOV, up to {VIDEO_MAX_MB} MB</span>}
                </span>
                <input
                  id={`sv-file-${s.key}`}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov"
                  hidden
                  onChange={(e) => {
                    choose(s.key, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : (
              <>
                <input
                  aria-label={`Link to video ${i + 1}`}
                  style={{ marginTop: 10 }}
                  value={s.url}
                  onChange={(e) => change(s.key, { url: e.target.value })}
                  placeholder="https://youtu.be/…  or  https://drive.google.com/file/d/…"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                />
                {link && ("error" in link ? (
                  !s.error && <p className="sv-check bad">{link.error}</p>
                ) : (
                  <p className="sv-check good">✓ {SOURCE_NAMES[link.source]} video{link.start ? `, starting at ${Math.floor(link.start / 60)}:${String(link.start % 60).padStart(2, "0")}` : ""}</p>
                ))}
              </>
            )}

            <label className="fld" htmlFor={`sv-label-${s.key}`}>Label <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
            <input id={`sv-label-${s.key}`} value={s.label} maxLength={80} onChange={(e) => change(s.key, { label: e.target.value })} placeholder={`e.g. Part ${i + 1}: the opening`} />

            {s.error && <p className="sv-check bad">{s.error}</p>}
          </fieldset>
        );
      })}

      {slotsLeft > 0 && (
        <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} disabled={busy} onClick={() => setSlots((all) => [...all, blank(next.current++)])}>
          + Add another video <span className="muted" style={{ fontWeight: 400 }}>({slotsLeft} more possible)</span>
        </button>
      )}

      {busy && (
        <div className="sv-progress" aria-live="polite">
          {total > 0 && <div className="sv-bar"><i style={{ width: `${stage === "Saving…" ? 100 : pct}%` }} /></div>}
          <span className="tiny muted">
            {stage} {total > 0 && stage !== "Saving…" ? `${pct}% of ${megabytes(total)}. ` : ""}Keep this page open until it finishes.
          </span>
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button type="submit" className="btn gold" disabled={busy}>
          {busy ? "Saving…" : into ? `Add ${slots.length === 1 ? "the video" : `${slots.length} videos`}` : "Save the lecture"}
        </button>
        {into && onDone && (
          <button type="button" className="btn ghost" onClick={onDone} disabled={busy}>Cancel</button>
        )}
      </div>
      {msg && (
        <div className={msg.ok ? "ok" : "err"} style={{ marginTop: 12 }}>
          {msg.text}
        </div>
      )}
    </form>
  );

  if (into) {
    return (
      <div className="sv-add">
        <div className="fld" style={{ marginTop: 0 }}>
          Add to “{into.title}” <span className="muted" style={{ fontWeight: 400 }}>(room for {into.room} more)</span>
        </div>
        {form}
      </div>
    );
  }

  const chosen = courses.find((c) => c.id === courseId);

  if (!open.length) {
    return (
      <div className="card">
        <h3>Add a recorded lecture</h3>
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          Each course can hold up to {MAX_SETS} recorded lectures, and {courses.length > 1 ? "every course" : "this course"} has{" "}
          {MAX_SETS} already. To add a new lecture, delete one below first (Edit › Delete this lecture).
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Add a recorded lecture</h3>
      <p className="small muted" style={{ margin: "4px 0 0" }}>
        Give the lecture a title and put up to {MAX_CLIPS} videos in it. Upload a file (up to {VIDEO_MAX_MB} MB) or paste a link
        for a bigger video. Each course can hold up to {MAX_SETS} recorded lectures
        {chosen && courses.length === 1 ? ` (this course has ${chosen.lectures ?? 0})` : ""}. Only the teachers of{" "}
        {courses.length > 1 ? "the course you choose" : "this course"} and administrators will see it; students never do.
        {isAdmin ? "" : " You can change or delete the lectures you add."}
      </p>
      {form}
      <details className="sv-tip">
        <summary>Video bigger than {VIDEO_MAX_MB} MB? Add it as a link</summary>
        <ul>
          <li><b>YouTube:</b> upload it with Visibility set to <b>Unlisted</b> (not Private), then copy the link from Share.</li>
          <li><b>Google Drive:</b> upload it, open Share, set General access to <b>Anyone with the link</b>, then Copy link.</li>
          <li><b>Teams or Stream recordings (OneDrive/SharePoint):</b> open the video, choose Share › <b>Embed code</b>, and paste the whole code.</li>
          <li><b>Vimeo</b> links and direct links to an MP4 file work too.</li>
        </ul>
        <p>The link is kept on this page only, so students do not see it. Anyone who already has the link could open it, so share it with no one else.</p>
      </details>
    </div>
  );
}
