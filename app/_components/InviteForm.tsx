"use client";

import { useState } from "react";

export default function InviteForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);

    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), role }),
    });
    const body = await res.json().catch(() => ({}));

    setBusy(false);
    if (!res.ok) {
      setResult({ ok: false, message: body.error ?? "The invitation could not be sent." });
      return;
    }
    setResult({
      ok: true,
      message: `Invited ${email} as ${role}. They will get an email with a link to set a password.`,
    });
    setEmail("");
    setFullName("");
  }

  return (
    <div className="card">
      <form onSubmit={send}>
        <label className="fld" htmlFor="full-name">Full name</label>
        <input
          id="full-name"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="As it should appear on the gradebook"
        />

        <label className="fld" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="fld" htmlFor="role">Role</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">Student — takes courses</option>
          <option value="teacher">Teacher — creates courses and marks work</option>
          <option value="admin">Admin — everything, including inviting others</option>
        </select>

        <button className="btn block" style={{ marginTop: 16 }} disabled={busy}>
          {busy ? "Sending…" : "Send the invitation"}
        </button>
      </form>

      {result && (
        <div className={result.ok ? "note" : "err"} style={{ marginTop: 14 }}>
          {result.message}
        </div>
      )}
    </div>
  );
}
