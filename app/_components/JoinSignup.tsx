"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { browserClient } from "@/app/_lib/supabase-browser";

/**
 * The form a student sees when they open a class link and have no account yet.
 * Creating the account and joining the class happen in one step on the server;
 * this then signs them in with the password they just chose, so they land in
 * the course rather than on a sign-in page.
 */
export default function JoinSignup({ code }: { code: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerSignIn, setOfferSignIn] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOfferSignIn(false);

    let data: any = null;
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, fullName, email, password }),
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

    // sign in with the password just chosen, so they go straight to the course
    const supabase = browserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      router.push(`/login?next=/activities`);
      return;
    }

    router.push(`/activities`);
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <label className="fld" htmlFor="jn">Your full name</label>
      <input
        id="jn"
        required
        minLength={2}
        maxLength={120}
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
        placeholder="As it appears on your student record"
      />

      <label className="fld" htmlFor="je">Your university email</label>
      <input
        id="je"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />

      <label className="fld" htmlFor="jp">Choose a password</label>
      <input
        id="jp"
        type={show ? "text" : "password"}
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <label className="tiny muted" style={{ display: "flex", gap: 7, marginTop: 7, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          style={{ width: "auto", margin: 0 }}
        />
        Show password
      </label>
      <p className="tiny muted" style={{ marginTop: 6 }}>
        At least 8 characters. You will use this email and password every time you sign in, so keep
        them somewhere safe.
      </p>

      {error && (
        <div className="err" style={{ marginTop: 12 }}>
          {error}
          {offerSignIn && (
            <>
              {" "}
              <Link href={`/login?next=/join/${code}`}>
                <b>Sign in instead</b>
              </Link>
            </>
          )}
        </div>
      )}

      <button className="btn gold block" style={{ marginTop: 16 }} disabled={busy}>
        {busy ? "Setting up your account…" : "Create my account and join"}
      </button>

      <p className="tiny muted center" style={{ marginTop: 12 }}>
        Already have an account? <Link href={`/login?next=/join/${code}`}>Sign in</Link>
      </p>
    </form>
  );
}
