"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { metricsOf, mmss, paceLabel } from "@/app/_lib/format";

type Props = {
  lessonId: string;
  sectionId: string;
  studentId: string;
  prepSeconds: number;
  targetSeconds: number;
  /** which attempt this recording will become: 1 or 2 */
  nextAttempt: number;
};

const OVERRUN = 45; // seconds past the target before the clock stops itself

/** Browser recordings often carry no length; this makes the player show it and allow seeking. */
function fixDuration(el: HTMLMediaElement | null) {
  if (!el) return;
  const onMeta = () => {
    if (el.duration === Infinity || Number.isNaN(el.duration)) {
      const back = () => {
        el.removeEventListener("timeupdate", back);
        el.currentTime = 0;
      };
      el.addEventListener("timeupdate", back);
      el.currentTime = 1e101;
    }
  };
  el.addEventListener("loadedmetadata", onMeta, { once: true });
}

export default function PracticeRecorder({
  lessonId,
  sectionId,
  studentId,
  prepSeconds,
  targetSeconds,
  nextAttempt,
}: Props) {
  const router = useRouter();
  const final = nextAttempt >= 2;

  const [prepLeft, setPrepLeft] = useState(prepSeconds);
  const [prepRunning, setPrepRunning] = useState(false);

  const [phase, setPhase] = useState<"idle" | "countin" | "recording" | "done">("idle");
  const [countIn, setCountIn] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [playback, setPlayback] = useState<string | null>(null);
  const [useVideo, setUseVideo] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognition = useRef<any>(null);
  const finalText = useRef("");
  const alive = useRef(true);
  const player = useRef<HTMLMediaElement | null>(null);

  // prep clock
  useEffect(() => {
    if (!prepRunning || prepLeft <= 0) return;
    const t = setTimeout(() => setPrepLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [prepRunning, prepLeft]);

  // tear everything down if the page unmounts mid-recording
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      try { if (recorder.current && recorder.current.state !== "inactive") { recorder.current.onstop = null; recorder.current.stop(); } } catch {}
      try { stream.current?.getTracks().forEach((t) => t.stop()); } catch {}
      try { recognition.current?.stop(); } catch {}
      if (ticker.current) clearInterval(ticker.current);
    };
  }, []);

  useEffect(() => {
    if (playback) fixDuration(player.current);
  }, [playback]);

  async function start() {
    setError(null);
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia(
        useVideo ? { audio: true, video: { width: { ideal: 640 } } } : { audio: true }
      );
    } catch {
      setError("The microphone was refused. Allow it in your browser's site settings and reload the page.");
      return;
    }
    if (!alive.current) { media.getTracks().forEach((t) => t.stop()); return; }

    stream.current = media;
    chunks.current = [];
    finalText.current = "";
    setTranscript("");
    setBlob(null);
    setPlayback(null);
    setElapsed(0);
    setRecordedVideo(useVideo);

    // three-second count-in
    setPhase("countin");
    for (let i = 3; i > 0; i--) {
      setCountIn(i);
      await new Promise((r) => setTimeout(r, 1000));
      if (!alive.current) { media.getTracks().forEach((t) => t.stop()); return; }
    }

    const types = useVideo
      ? ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
      : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mime = types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    const opts: MediaRecorderOptions = { audioBitsPerSecond: 48000 };
    if (useVideo) opts.videoBitsPerSecond = 600000;
    if (mime) opts.mimeType = mime;

    let mr: MediaRecorder;
    try { mr = new MediaRecorder(media, opts); } catch { mr = new MediaRecorder(media); }
    recorder.current = mr;
    mr.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data); };
    mr.onstop = () => {
      const type = mr.mimeType || chunks.current[0]?.type || (useVideo ? "video/webm" : "audio/webm");
      const b = new Blob(chunks.current, { type });
      setBlob(b);
      setPlayback(URL.createObjectURL(b));
      stream.current?.getTracks().forEach((t) => t.stop());
      setPhase("done");
    };

    mr.start(1000);
    started.current = Date.now();
    setPhase("recording");

    ticker.current = setInterval(() => {
      const secs = (Date.now() - started.current) / 1000;
      setElapsed(secs);
      if (secs >= targetSeconds + OVERRUN) stop();
    }, 200);

    startSpeech();
  }

  function startSpeech() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const sr = new SR();
      sr.lang = "en-GB";
      sr.continuous = true;
      sr.interimResults = true;
      sr.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText.current += r[0].transcript + " ";
          else interim += r[0].transcript;
        }
        setTranscript((finalText.current + interim).trim());
      };
      sr.onerror = () => {};
      sr.start();
      recognition.current = sr;
    } catch {}
  }

  function stop() {
    if (ticker.current) { clearInterval(ticker.current); ticker.current = null; }
    try { if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop(); } catch {}
    try { recognition.current?.stop(); } catch {}
  }

  async function save() {
    if (!blob) { setError("Record something first."); return; }
    if (final && !window.confirm("Save this as your final attempt? Attempt 2 cannot be deleted.")) return;
    setSaving(true);
    setError(null);

    const supabase = browserClient();
    const type = (blob.type || "audio/webm").split(";")[0];
    const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
    const submissionId = crypto.randomUUID();
    // a "-v" suffix marks a video recording, so it is played back as video
    const path = `${sectionId}/${studentId}/${submissionId}${recordedVideo ? "-v" : ""}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("recordings")
      .upload(path, blob, { contentType: type, upsert: false });

    if (upErr) {
      setSaving(false);
      setError(
        upErr.message.includes("Bucket not found")
          ? 'The "recordings" storage bucket does not exist yet. Create it in Supabase → Storage, and keep it private.'
          : `The recording could not be uploaded: ${upErr.message}. It is still here, so try again.`
      );
      return;
    }

    // the database numbers the attempt itself
    const { error: rowErr } = await supabase.from("submissions").insert({
      id: submissionId,
      lesson_id: lessonId,
      student_id: studentId,
      section_id: sectionId,
      file_path: path,
      transcript: transcript.slice(0, 12000),
      duration_seconds: Math.round(elapsed),
    });

    if (rowErr) {
      await supabase.storage.from("recordings").remove([path]);
      setSaving(false);
      setError(
        rowErr.message.includes("both attempts")
          ? "Both attempts for this task have already been saved."
          : `The attempt could not be saved: ${rowErr.message}`
      );
      return;
    }

    router.refresh();
  }

  const left = targetSeconds - elapsed;
  const over = phase === "recording" && left < 0;
  const warn = phase === "recording" && left >= 0 && left <= 15;
  const pct = Math.min(100, (elapsed / targetSeconds) * 100);
  const m = blob ? metricsOf(transcript, elapsed, targetSeconds) : null;

  let clock = mmss(targetSeconds);
  let sub = `speaking time · target ${mmss(targetSeconds)}`;
  if (phase === "countin") { clock = String(countIn); sub = "get ready…"; }
  else if (phase === "recording") {
    clock = left >= 0 ? mmss(Math.ceil(left)) : `+${mmss(Math.floor(-left))}`;
    sub = left >= 0 ? `time left · ${mmss(elapsed)} spoken` : `over the target · stops on its own at +${mmss(OVERRUN)}`;
  } else if (phase === "done") { clock = mmss(elapsed); sub = `your length · target ${mmss(targetSeconds)}`; }

  const busy = phase === "countin" || phase === "recording";

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3>Preparation</h3>
          <span className="small muted">{mmss(prepLeft)}</span>
        </div>
        <div className="bar"><i style={{ width: `${prepSeconds ? 100 * (1 - prepLeft / prepSeconds) : 100}%` }} /></div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn gold sm" onClick={() => setPrepRunning(true)} disabled={prepRunning || prepLeft <= 0}>
            {prepRunning && prepLeft > 0 ? "Running…" : "Start prep timer"}
          </button>
          <button className="btn ghost sm" onClick={() => { setPrepRunning(false); setPrepLeft(0); }}>
            Skip to recording
          </button>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Plan a framework, not a script. Reading aloud costs marks under criterion 3.
        </p>
      </div>

      <div className="card">
        <div className="spread">
          <h3>Record · attempt {nextAttempt} of 2</h3>
          <label className="tiny muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={useVideo}
              disabled={busy}
              onChange={(e) => setUseVideo(e.target.checked)}
              style={{ width: "auto", margin: 0 }}
            />
            include video
          </label>
        </div>

        <div className={final ? "err" : "note"} style={{ marginTop: 8 }}>
          {final ? (
            <>This is your <b>final attempt</b>. Once you save it, it cannot be deleted.</>
          ) : (
            <>This will be <b>attempt 1</b>. You can delete it later if you want a fresh start.</>
          )}
        </div>

        <div className={`timer${over || phase === "countin" ? " over" : warn ? " warn" : ""}`}>{clock}</div>
        <div className="center tiny muted">{sub}</div>
        <div className="bar"><i className={over ? "over" : ""} style={{ width: `${phase === "idle" ? 0 : pct}%` }} /></div>

        <div className="row" style={{ marginTop: 14, justifyContent: "center" }}>
          <button className="btn rec" onClick={start} disabled={busy || saving}>
            ● {blob ? "Record again" : "Start recording"}
          </button>
          <button className="btn ghost" onClick={stop} disabled={phase !== "recording"}>Stop</button>
        </div>

        {phase === "recording" && (
          <p className="small muted center" style={{ marginTop: 12 }}>
            <span className="dot" /> recording…
          </p>
        )}

        {playback && phase === "done" && (
          <div style={{ marginTop: 14 }}>
            {recordedVideo ? (
              <video ref={(el) => { player.current = el; }} className="play" controls playsInline src={playback} />
            ) : (
              <audio ref={(el) => { player.current = el; }} controls src={playback} />
            )}
            <p className="tiny muted center" style={{ marginTop: 6 }}>
              Not saved yet. Recording again replaces this take and does not use up an attempt.
            </p>
          </div>
        )}

        {blob && phase === "done" && (
          <>
            {m && (
              <div className="note" style={{ marginTop: 14 }}>
                <b>{mmss(m.secs)}</b> spoken · target {mmss(m.target)} — <b>{m.timing}</b>
                {m.wpm ? <> · about <b>{m.wpm}</b> words per minute ({paceLabel(m.wpm)})</> : null}
                {m.words ? <> · {m.fillers} filler word{m.fillers === 1 ? "" : "s"}</> : null}
              </div>
            )}

            <label className="fld" htmlFor="transcript">Transcript (the AI reads only this)</label>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Fills in automatically in Chrome. Otherwise type roughly what you said."
              style={{ minHeight: 110 }}
            />

            <button
              className={`btn block${final ? " gold" : ""}`}
              style={{ marginTop: 14 }}
              onClick={save}
              disabled={saving}
            >
              {saving ? "Uploading…" : `Save attempt ${nextAttempt}`}
            </button>
          </>
        )}

        {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    </>
  );
}
