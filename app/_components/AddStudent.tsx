"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  name: string;
  email: string;
  status: "added" | "already";
  newAccount: boolean;
  link: string | null;
};

/**
 * Adds one student to the class by email — the other way in besides the
 * class link. A new student gets a one-time link to choose their password,
 * which the teacher sends by email or WhatsApp.
 */
export default function AddStudent({
  sectionId,
  courseTitle,
  sectionNumber,
  term,
  teacherName,
}: {
  sectionId: string;
  courseTitle: string;
  sectionNumber: string;
  term: string;
  teacherName: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/sections/${sectionId}/students`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error ?? "The student could not be added.");
      } else {
        setResult(out as Result);
        setFullName("");
        setEmail("");
        router.refresh();
      }
    } catch {
      setError("The connection failed. Please try again.");
    }
    setBusy(false);
  }

  const message = result?.link
    ? `Dear ${result.name},\n\n` +
      `You have been added to ${courseTitle} (Section ${sectionNumber} · ${term}).\n\n` +
      `Open this link to choose your password and start:\n${result.link}\n\n` +
      `Sign in with ${result.email}. The link works once and expires in 14 days.\n\n` +
      `${teacherName}`
    : "";

  async function copy(what: "link" | "message") {
    try {
      await navigator.clipboard.writeText(what === "link" ? result?.link ?? "" : message);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Copying was blocked. Select the text and copy it by hand.");
    }
  }

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--rule)", paddingTop: 12 }}>
      <h3 style={{ fontSize: 14 }}>Add a student by email</h3>
      <form onSubmit={add}>
        <div className="row" style={{ marginTop: 8, gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 180px" }}>
            <label className="fld" htmlFor={`as-n-${sectionId}`} style={{ marginTop: 0 }}>Full name</label>
            <input
              id={`as-n-${sectionId}`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              placeholder="Needed for a new student"
              autoComplete="off"
            />
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <label className="fld" htmlFor={`as-e-${sectionId}`} style={{ marginTop: 0 }}>Email</label>
            <input
              id={`as-e-${sectionId}`}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <button className="btn sm" disabled={busy} style={{ flex: "0 0 auto" }}>
            {busy ? "Adding…" : "Add student"}
          </button>
        </div>
      </form>

      {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}

      {result && (
        <div className="ok" style={{ marginTop: 10 }}>
          <b>{result.name}</b> ({result.email}){" "}
          {result.status === "already" ? "is already in this class." : "has been added to this class."}{" "}
          {result.link
            ? result.newAccount
              ? "Send them this one-time link to choose their password:"
              : "They have not set a password yet. Here is a new one-time link (the old one no longer works):"
            : "They already have an account and sign in as usual."}
          {result.link && (
            <>
              <input
                readOnly
                value={result.link}
                onFocus={(e) => e.currentTarget.select()}
                style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
              />
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="btn sm" onClick={() => copy("link")}>
                  {copied === "link" ? "Copied" : "Copy link"}
                </button>
                <button type="button" className="btn ghost sm" onClick={() => copy("message")}>
                  {copied === "message" ? "Copied" : "Copy message"}
                </button>
                <a
                  className="btn ghost sm"
                  href={`mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent(`${courseTitle}: your account`)}&body=${encodeURIComponent(message)}`}
                >
                  Email it
                </a>
                <a
                  className="btn ghost sm"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                >
                  WhatsApp
                </a>
              </div>
            </>
          )}
        </div>
      )}

      <p className="tiny muted" style={{ marginTop: 8 }}>
        A new student gets a one-time link (valid 14 days) to choose their own password. Lost the link? Add the
        same email again for a fresh one. Students can still join with the class link above.
      </p>
    </div>
  );
}
