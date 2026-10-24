"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TermsAgree } from "./TermsText";

/** The tick box and button on /agreement. */
export default function AgreementForm({ next }: { next: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return setError("Tick the box to accept the terms of use.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agreed: true }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        return setError(out.error ?? "Your answer could not be saved. Please try again.");
      }
    } catch {
      setBusy(false);
      return setError("The site could not be reached. Check your connection and try again.");
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={submit}>
        <TermsAgree id="agree" checked={agreed} onChange={setAgreed} />
        {error && (
          <div className="err" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <button className="btn gold block" style={{ marginTop: 16 }} disabled={busy || !agreed}>
          {busy ? "Saving…" : "Accept and continue"}
        </button>
      </form>
      <form action="/auth/signout" method="post" style={{ marginTop: 10, textAlign: "center" }}>
        <button type="submit" className="btn ghost sm">
          Not now, sign out
        </button>
      </form>
    </>
  );
}
