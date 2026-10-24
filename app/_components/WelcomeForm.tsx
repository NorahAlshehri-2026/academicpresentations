"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { TermsAgree } from "./TermsText";

/** Lets a student their teacher added by email choose a password, then signs them in. */
export default function WelcomeForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerSignIn, setOfferSignIn] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOfferSignIn(false);
    if (password.length < 8) return setError("Please choose a password of at least 8 characters.");
    if (password !== again) return setError("The two passwords do not match.");
    if (!agreed) return setError("Tick the box to accept the terms of use.");

    setBusy(true);
    let res: Response;
    try {
      res = await fetch("/api/welcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password, agreed }),
      });
    } catch {
      setBusy(false);
      return setError("The connection failed. Please try again.");
    }
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setOfferSignIn(!!out.signIn);
      return setError(out.error ?? "Your password could not be saved. Please try again.");
    }

    const supabase = browserClient();
    await supabase.auth.signOut().catch(() => undefined); // in case someone else was signed in on this device
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: out.email ?? email, password });
    if (signInError) {
      router.push("/login?next=/activities");
      return;
    }
    router.push("/activities");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <label className="fld" htmlFor="we">Your email</label>
      <input id="we" type="email" value={email} readOnly autoComplete="username" />

      <label className="fld" htmlFor="wp">Choose a password</label>
      <input
        id="wp"
        type={show ? "text" : "password"}
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <label className="fld" htmlFor="wp2">Type it again</label>
      <input
        id="wp2"
        type={show ? "text" : "password"}
        required
        minLength={8}
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        autoComplete="new-password"
      />
      <label className="tiny muted" style={{ display: "flex", gap: 7, marginTop: 7, alignItems: "center" }}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ width: "auto", margin: 0 }} />
        Show password
      </label>
      <p className="tiny muted" style={{ marginTop: 6 }}>
        At least 8 characters. You will use this email and password every time you sign in. This link works once.
      </p>

      <TermsAgree id="wt" checked={agreed} onChange={setAgreed} />

      {error && (
        <div className="err" style={{ marginTop: 12 }}>
          {error}
          {offerSignIn && (
            <>
              {" "}
              <Link href="/login?next=/activities"><b>Sign in</b></Link>
            </>
          )}
        </div>
      )}

      <button className="btn gold block" style={{ marginTop: 16 }} disabled={busy || !agreed}>
        {busy ? "Setting up your account…" : "Save my password and start"}
      </button>
    </form>
  );
}
