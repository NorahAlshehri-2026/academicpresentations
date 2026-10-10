"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ASSISTANTS: [string, string][] = [
  ["Claude", "https://claude.ai/new"],
  ["ChatGPT", "https://chatgpt.com/"],
  ["Gemini", "https://gemini.google.com/app"],
];

/**
 * AI feedback, free of charge: the site writes the request, the student pastes
 * it into any free AI assistant, then pastes the reply back here, where it is
 * read and saved with the recording.
 *
 * If the academy has switched on paid automatic feedback (AI_FEEDBACK_AUTO=on
 * as well as an API key in the hosting settings), a one-tap button appears too.
 */
export default function AiFeedbackButton({
  submissionId,
  hasPeer,
  hasAi,
  hasTranscript,
  auto = false,
}: {
  submissionId: string;
  hasPeer: boolean;
  hasAi: boolean;
  hasTranscript: boolean;
  auto?: boolean;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasAi) return null;
  const ready = hasPeer && hasTranscript;

  async function write() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ai-feedback?submissionId=${encodeURIComponent(submissionId)}`);
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "The request could not be written.");
      return;
    }
    setPrompt(body.prompt);
  }

  async function copy() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copying was blocked. Select the text in the box and copy it by hand.");
    }
  }

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ai-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, ...body }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(out.error ?? "The feedback could not be saved.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
      <h3 style={{ fontSize: 14 }}>AI feedback</h3>
      <p className="small muted" style={{ marginTop: 4 }}>
        Free: the site writes the request for you, you paste it into any free AI assistant, then paste its answer
        back here. It checks the same lesson objectives (or, for the final presentation, the rubric) from your
        transcript and timing; eye contact and posture stay your classmate&rsquo;s job.
      </p>

      {!hasTranscript ? (
        <div className="note" style={{ marginTop: 10 }}>
          There is no transcript on this attempt, so there is nothing for the AI to read.
        </div>
      ) : !hasPeer ? (
        <div className="note" style={{ marginTop: 10 }}>
          Classmate feedback comes first. Share this recording, and once a classmate has given feedback the AI builds on
          what they said.
        </div>
      ) : null}

      {!prompt ? (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn gold" onClick={write} disabled={busy || !ready} style={{ flex: 1 }}>
            {busy ? "Writing…" : "Write the feedback request"}
          </button>
          {auto && (
            <button className="btn ghost" onClick={() => send({})} disabled={busy || !ready}>
              Get it automatically
            </button>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div className="note">
            <b>Step 1.</b> Copy the request and open a free assistant. Paste it in and send.
            <textarea readOnly value={prompt} onFocus={(e) => e.currentTarget.select()} style={{ minHeight: 120, marginTop: 8, fontSize: 12.5 }} />
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn sm" onClick={copy}>{copied ? "Copied" : "Copy the request"}</button>
              {ASSISTANTS.map(([name, url]) => (
                <a key={name} className="btn ghost sm" href={url} target="_blank" rel="noopener noreferrer">
                  Open {name}
                </a>
              ))}
            </div>
            <p className="tiny muted" style={{ margin: "8px 0 0" }}>Any assistant works. A free account is enough.</p>
          </div>

          <label className="fld" htmlFor={`ai-${submissionId}`}>Step 2. Paste the assistant&rsquo;s whole answer here</label>
          <textarea
            id={`ai-${submissionId}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder='It starts with { …'
          />
          <button className="btn gold block" style={{ marginTop: 10 }} onClick={() => send({ reply })} disabled={busy || !reply.trim()}>
            {busy ? "Saving…" : "Save the AI feedback"}
          </button>
        </div>
      )}

      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
