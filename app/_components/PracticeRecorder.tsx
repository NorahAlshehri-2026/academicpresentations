"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";

type Props = {
  lessonId: string;
  sectionId: string;
  studentId: string;
  prepSeconds: number;
  targetSeconds: number;
  attemptNo: number;
};

const mmss = (s: number) => {
  const n = Math.max(0, Math.round(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};

const FILLERS = ["um", "uh", "er", "erm", "like", "you know", "basically", "actually", "sort of", "kind of"];

function metricsOf(text: string, secs: number, target: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wpm = secs > 5 && words.length ? Math.round(words.length / (secs / 60)) : null;
  const low = ` ${text.toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ")} `;
  let fillers = 0;
  FILLERS.forEach((f) => {
    const m = low.match(new RegExp(`\\s${f.replace(/ /g, "\\s")}\\s`, "g"));
    if (m) fillers += m.length;
  });
  const diff = secs - target;
  return {
    words: words.length,
    wpm,
    fillers,
    secs: Math.round(secs),
    target,
    timing:
      Math.abs(diff) <= target * 0.15
        ? "within target"
        : diff > 0
        ? `over by ${mmss(diff)}`
        : `under by ${mmss(-diff)}`,
  };
}

export default function PracticeRecorder({
  lessonId,
  sectionId,
  studentId,
  prepSeconds,
  targetSeconds,
  attemptNo,
}: Props) {
  const router = useRouter();

  const [prepLeft, setPrepLeft] = useState(prepSeconds);
  const [prepRunning, setPrepRunning] = useState(false);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [playback, setPlayback] = useState<string | null>(null);
  const [useVideo, setUseVideo] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognition = useRef<any>(null);
  const finalText = useRef("");

  // prep clock
  useEffect(() => {
    if (!prepRunning || prepLeft <= 0) return;
    const t = setTimeout(() => setPrepLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [prepRunning, prepLeft]);

  // tear everything down if the page unmounts mid-recording
  useEffect(() => {
    return () => {
      try { recorder.current?.state !== "inactive" && recorder.current?.stop(); } catch {}
      try { stream.current?.getTracks().forEach((t) => t.stop()); } catch {}
      try { recognition.current?.stop(); } catch {}
      if (ticker.current) clearInterval(ticker.current);
    };
  }, []);

  async function start() {
    setError(null);
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia(
        useVideo ? { audio: true, video: { width: { ideal: 640 } } } : { audio: true }
      );
    } catch {
      setError(
        "The microphone was refused. Allow it in your browser's site settings and reload the page."
      );
      return;
    }

    stream.current = media;
    chunks.current = [];
    finalText.current = "";

    const types = useVideo
      ? ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
      : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mime = types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));

    const mr = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
    recorder.current = mr;
    mr.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data); };
    mr.onstop = () => {
      const type = useVideo ? "video/webm" : chunks.current[0]?.type || "audio/webm";
      const b = new Blob(chunks.current, { type });
      setBlob(b);
      setPlayback(URL.createObjectURL(b));
      stream.current?.getTracks().forEach((t) => t.stop());
    };

    mr.start();
    started.current = Date.now();
    setRecording(true);
    setElapsed(0);

    const hardStop = targetSeconds + 45;
    ticker.current = setInterval(() => {
      const secs = (Date.now() - started.current) / 1000;
      setElapsed(secs);
      if (secs >= hardStop) stop();
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
    try { recorder.current?.state !== "inactive" && recorder.current?.stop(); } catch {}
    try { recognition.current?.stop(); } catch {}
    if (ticker.current) { clearInterval(ticker.current); ticker.current = null; }
    setRecording(false);
  }

  async function save() {
    if (!blob) { setError("Record something first."); return; }
    setSaving(true);
    setError(null);

    const supabase = browserClient();
    const ext = useVideo ? "webm" : blob.type.includes("mp4") ? "mp4" : "webm";
    const submissionId = crypto.randomUUID();
    const path = `${sectionId}/${studentId}/${submissionId}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("recordings")
      .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });

    if (upErr) {
      setSaving(false);
      setError(
        upErr.message.includes("Bucket not found")
          ? 'The "recordings" storage bucket does not exist yet. Create it in Supabase → Storage, and keep it private.'
          : `The recording could not be uploaded: ${upErr.message}`
      );
      return;
    }

    const m = metricsOf(transcript, elapsed, targetSeconds);

    const { error: rowErr } = await supabase.from("submissions").insert({
      id: submissionId,
      lesson_id: lessonId,
      student_id: studentId,
      section_id: sectionId,
      attempt_no: attemptNo,
      file_path: path,
      transcript: transcript.slice(0, 12000),
      duration_seconds: m.secs,
    });

    if (rowErr) {
      setSaving(false);
      // the file is already uploaded; leave it rather than risk deleting someone else's
      setError(`Saved the audio but could not record the submission: ${rowErr.message}`);
      return;
    }

    router.refresh();
  }

  const m = blob ? metricsOf(transcript, elapsed, targetSeconds) : null;
  const over = elapsed > targetSeconds;
  const pct = Math.min(100, (elapsed / targetSeconds) * 100);

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3>Preparation</h3>
          <span className="small muted">{mmss(prepLeft)}</span>
        </div>
        <div className="bar"><i style={{ width: `${100 * (1 - prepLeft / prepSeconds)}%` }} /></div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn gold sm" onClick={() => setPrepRunning(true)} disabled={prepRunning}>
            {prepRunning ? "Running…" : "Start prep timer"}
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
          <h3>Record</h3>
          <label className="tiny muted">
            <input
              type="checkbox"
              checked={useVideo}
              disabled={recording}
              onChange={(e) => setUseVideo(e.target.checked)}
              style={{ width: "auto", marginRight: 6 }}
            />
            include video
          </label>
        </div>

        <div className={`timer${over ? " over" : ""}`}>{mmss(elapsed)}</div>
        <div className="center tiny muted">target {mmss(targetSeconds)}</div>
        <div className="bar"><i className={over ? "over" : ""} style={{ width: `${pct}%` }} /></div>

        <div className="row" style={{ marginTop: 14, justifyContent: "center" }}>
          {!recording ? (
            <button className="btn rec" onClick={start}>
              ● {blob ? "Record again" : "Start recording"}
            </button>
          ) : (
            <button className="btn ghost" onClick={stop}>Stop</button>
          )}
        </div>

        {recording && (
          <p className="small muted center" style={{ marginTop: 12 }}>
            <span className="dot" /> recording — the clock stops itself 45 seconds past target
          </p>
        )}

        {playback && !recording && (
          <div style={{ marginTop: 14 }}>
            {useVideo ? (
              <video className="play" controls playsInline src={playback} />
            ) : (
              <audio controls src={playback} />
            )}
          </div>
        )}

        {blob && !recording && (
          <>
            {m && (
              <div className="note" style={{ marginTop: 14 }}>
                <b>{mmss(m.secs)}</b> spoken · target {mmss(m.target)} — <b>{m.timing}</b>
                {m.wpm ? (
                  <>
                    {" "}· about <b>{m.wpm}</b> words per minute
                    {m.wpm < 110 ? " (slow)" : m.wpm > 165 ? " (fast)" : " (comfortable)"}
                  </>
                ) : null}
                {m.words ? <> · {m.fillers} filler word{m.fillers === 1 ? "" : "s"}</> : null}
              </div>
            )}

            <label className="fld" htmlFor="transcript">Transcript</label>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Fills in automatically in Chrome. Otherwise type roughly what you said — the feedback reads only this."
              style={{ minHeight: 110 }}
            />

            <label className="fld" htmlFor="topic">Topic (optional)</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Solar energy in desert regions"
            />

            <button className="btn block" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
              {saving ? "Submitting…" : "Submit this attempt"}
            </button>
          </>
        )}

        {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    </>
  );
}
