"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AiFeedbackButton({
  submissionId,
  hasPeer,
  hasAi,
  hasTranscript,
}: {
  submissionId: string;
  hasPeer: boolean;
  hasAi: boolean;
  hasTranscript: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasAi) return null;

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ai-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "The feedback could not be generated.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
      <p className="small muted">
        AI feedback reads your transcript and timing and scores the same rubric. It judges what can be
        heard in words and timing — eye contact, posture and gestures stay your partner&rsquo;s job.
      </p>
      {!hasTranscript ? (
        <div className="note" style={{ marginTop: 10 }}>
          There is no transcript on this attempt, so there is nothing for the AI to read. Record again
          and type roughly what you said before submitting.
        </div>
      ) : !hasPeer ? (
        <div className="note" style={{ marginTop: 10 }}>
          Partner feedback comes first. Once a classmate has scored this, the AI will build on what they
          said rather than replacing them.
        </div>
      ) : null}
      <button
        className="btn gold block"
        style={{ marginTop: 12 }}
        onClick={run}
        disabled={busy || !hasPeer || !hasTranscript}
      >
        {busy ? "Reading your transcript…" : "Get AI feedback"}
      </button>
      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
