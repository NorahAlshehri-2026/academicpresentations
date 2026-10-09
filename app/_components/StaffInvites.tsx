"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";

type Pending = { token: string; role: "teacher" | "admin"; note: string | null; created_at: string };

/**
 * The owner's panel for inviting teachers and administrators. Each link works
 * once. Only the academy owner can create or see these; the database refuses
 * anyone else, so this panel is only a convenience.
 */
export default function StaffInvites({ pending }: { pending: Pending[] }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ url: string; role: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);
  const urlFor = (t: string) => `${origin}/invite/${t}`;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMade(null);
    const supabase = browserClient();
    const { data, error: err } = await supabase
      .from("staff_invites")
      .insert({ role, note: note.trim() || null })
      .select("token")
      .single();
    setBusy(false);
    if (err || !data) {
      setError(
        err?.message.includes("row-level security")
          ? "Only the academy owner can invite teachers and administrators."
          : err?.message ?? "The link could not be made."
      );
      return;
    }
    setMade({ url: urlFor(data.token), role });
    setNote("");
    router.refresh();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      window.prompt("Copy this link:", text);
    }
  }

  async function cancel(token: string) {
    if (!window.confirm("Cancel this link? It will stop working.")) return;
    const supabase = browserClient();
    const { error: err } = await supabase.from("staff_invites").update({ revoked: true }).eq("token", token);
    if (err) setError(err.message);
    router.refresh();
  }

  const label = (r: string) => (r === "admin" ? "administrator" : "teacher");
  const wa = (url: string, r: string) =>
    `https://wa.me/?text=${encodeURIComponent(
      `You're invited to ${r === "admin" ? "help run" : "teach on"} the Academic Presentations academy. ` +
        `Open this link, add your name, email and a password. It works once.\n${url}`
    )}`;

  return (
    <>
      <div className="card">
        <h3>Invite a teacher or administrator</h3>
        <p className="small muted">
          Each link works once. Send it privately; the person opens it and adds their own name, email and password.
          Nobody receives an email, and only you can make these links.
        </p>
        <form onSubmit={create}>
          <label className="fld" htmlFor="iv-role">Role</label>
          <select id="iv-role" value={role} onChange={(e) => setRole(e.target.value as any)}>
            <option value="teacher">Teacher: opens classes, shares class links, marks work</option>
            <option value="admin">Administrator: sees every class and every person</option>
          </select>
          <label className="fld" htmlFor="iv-note">Who is it for? (only you see this)</label>
          <input id="iv-note" type="text" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Dr Sara, Level B" />
          <button className="btn gold block" style={{ marginTop: 14 }} disabled={busy}>
            {busy ? "Making the link…" : "Create invitation link"}
          </button>
        </form>

        {made && (
          <div className="ok" style={{ marginTop: 12 }}>
            <b>Link ready.</b> Send it to the {label(made.role)}. It works once.
            <div className="linkbox">
              <input readOnly value={made.url} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn sm" onClick={() => copy(made.url)}>
                {copied === made.url ? "Copied" : "Copy link"}
              </button>
              <a className="btn ghost sm" target="_blank" rel="noopener noreferrer" href={wa(made.url, made.role)}>WhatsApp</a>
            </div>
          </div>
        )}
        {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="card">
        <h3>Links not used yet</h3>
        {pending.length ? (
          pending.map((p) => (
            <div className="mate" key={p.token}>
              <div className="grow">
                <b className="small">{p.note || "(no name noted)"}</b>{" "}
                <span className={`pill ${p.role === "admin" ? "c3" : "c1"}`}>{label(p.role)}</span>
                <div className="tiny muted">created {new Date(p.created_at).toLocaleDateString("en-GB")}</div>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => copy(urlFor(p.token))}>
                {copied === urlFor(p.token) ? "Copied" : "Copy link"}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => cancel(p.token)}>Cancel</button>
            </div>
          ))
        ) : (
          <p className="small muted">None. Every link you made has been used or cancelled.</p>
        )}
      </div>
    </>
  );
}
