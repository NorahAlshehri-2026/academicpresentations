"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { browserClient } from "@/app/_lib/supabase-browser";

/** Accepting a staff invitation: create an account, or raise the one you are signed in with. */
export default function StaffJoin({
  token,
  role,
  signedInAs,
}: {
  token: string;
  role: string;
  signedInAs: { name: string; role: string } | null;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerSignIn, setOfferSignIn] = useState(false);

  const home = role === "admin" ? "/admin" : "/teach";

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setOfferSignIn(false);
    if (!signedInAs && password !== password2) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);

    let data: any = null;
    try {
      const res = await fetch("/api/staff-join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(signedInAs ? { token } : { token, fullName, email, password }),
      });
      data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setOfferSignIn(Boolean(data?.signIn));
        setBusy(false);
        return;
      }
    } catch {
      setError("The site could not be reached. Check your connection and try again.");
      setBusy(false);
      return;
    }

    if (!signedInAs) {
      const { error: signInError } = await browserClient().auth.signInWithPassword({ email, password });
      if (signInError) {
        router.push(`/login?next=${home}`);
        return;
      }
    }
    router.push(home);
    router.refresh();
  }

  if (signedInAs) {
    return (
      <>
        <p className="small" style={{ marginTop: 10 }}>
          You are signed in as <b>{signedInAs.name}</b>.
        </p>
        <button className="btn gold block" style={{ marginTop: 12 }} onClick={() => submit()} disabled={busy}>
          {busy ? "Accepting…" : "Accept the invitation"}
        </button>
        {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
      </>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <label className="fld" htmlFor="sj-n">Your full name</label>
      <input id="sj-n" required minLength={2} maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />

      <label className="fld" htmlFor="sj-e">Your email</label>
      <input id="sj-e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />

      <label className="fld" htmlFor="sj-p">Choose a password</label>
      <input id="sj-p" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />

      <label className="fld" htmlFor="sj-p2">Type it again</label>
      <input id="sj-p2" type="password" required minLength={8} value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />

      {error && (
        <div className="err" style={{ marginTop: 12 }}>
          {error}
          {offerSignIn && (
            <>
              {" "}
              <Link href={`/login?next=/invite/${token}`}><b>Sign in instead</b></Link>
            </>
          )}
        </div>
      )}

      <button className="btn gold block" style={{ marginTop: 16 }} disabled={busy}>
        {busy ? "Setting up your account…" : "Create my account"}
      </button>
      <p className="tiny muted center" style={{ marginTop: 12 }}>
        Already have an account? <Link href={`/login?next=/invite/${token}`}>Sign in first</Link>
      </p>
    </form>
  );
}
