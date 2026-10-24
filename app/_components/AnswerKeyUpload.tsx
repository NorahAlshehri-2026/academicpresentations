"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Adds or replaces the coursebook's answer key (answer-key.json). Teachers and
 * administrators then see an answer button beside each exercise in the
 * Coursebook; students never do.
 */
export default function AnswerKeyUpload({ count, updated }: { count: number; updated: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(method: "POST" | "DELETE", body?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/coursebook/answers", {
        method,
        headers: { "content-type": "application/json" },
        body,
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: out.error ?? "That did not work. Please try again." });
      else {
        setMsg({ ok: true, text: method === "POST" ? `Saved: ${out.count} answers.` : "The answer key has been removed." });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "The site could not be reached. Check your connection and try again." });
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
      JSON.parse(text);
    } catch {
      setMsg({ ok: false, text: "That file could not be read. Choose the answer-key.json file." });
      return;
    }
    await send("POST", text);
  }

  const when = updated
    ? new Date(updated).toLocaleString("en-GB", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="card">
      <h3>Answer key</h3>
      <p className="small" style={{ margin: "4px 0 0" }}>
        {count ? (
          <>
            <b>{count} answers</b>
            {when ? `, updated ${when}` : ""}. Teachers and administrators see an answer button beside each exercise in the
            Coursebook. Students never see it.
          </>
        ) : (
          <span className="muted">No answer key yet.</span>
        )}
      </p>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        It is kept in private storage that students cannot open, and it is never sent to a student&rsquo;s browser.
      </p>
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Saving…" : count ? "Replace the answer key" : "Upload the answer key"}
        </button>
        {count > 0 && (
          <button type="button" className="btn ghost sm" onClick={() => send("DELETE")} disabled={busy}>
            Remove it
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="Answer key file"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      {msg && (
        <div className={msg.ok ? "note" : "err"} style={{ marginTop: 12 }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
