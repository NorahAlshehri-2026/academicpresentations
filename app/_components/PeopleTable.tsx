"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDate } from "@/app/_lib/format";

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", teacher: "Teacher", student: "Student" };

type Person = { id: string; full_name: string; email: string; role: string; active: boolean; created_at: string };

/**
 * Everyone in the academy. The owner can tick student accounts and delete them
 * for good; teachers and administrators cannot be ticked.
 */
export default function PeopleTable({ list, ownerId, canDelete }: { list: Person[]; ownerId: string | null; canDelete: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const students = list.filter((p) => p.role === "student");
  const allPicked = students.length > 0 && students.every((s) => picked.has(s.id));

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(students.map((s) => s.id)));

  async function remove() {
    const n = picked.size;
    if (!n) return;
    const typed = window.prompt(
      `Delete ${n} student account${n === 1 ? "" : "s"} for good?\n\n` +
        "Their sign-in, recordings, feedback and marks are all deleted. This cannot be undone.\n\n" +
        "Type DELETE to confirm."
    );
    if (typed?.trim().toUpperCase() !== "DELETE") return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/delete-students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: Array.from(picked) }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (body.error) {
      setMsg({ ok: false, text: body.error });
    } else {
      const done = (body.deleted ?? []).length;
      const bad = (body.failed ?? []) as { name: string; error: string }[];
      setMsg({
        ok: !bad.length,
        text:
          `${done} account${done === 1 ? "" : "s"} deleted.` +
          (bad.length ? ` Not deleted: ${bad.map((b) => `${b.name} (${b.error})`).join("; ")}` : ""),
      });
      setPicked(new Set());
    }
    router.refresh();
  }

  return (
    <div className="card">
      <div className="spread">
        <h3>People</h3>
        {canDelete && students.length > 0 && (
          <button
            type="button"
            className="btn ghost sm"
            style={{ color: "var(--red)" }}
            onClick={remove}
            disabled={!picked.size || busy}
          >
            {busy ? "Deleting…" : `Delete ${picked.size || ""} student account${picked.size === 1 ? "" : "s"}`.replace("  ", " ")}
          </button>
        )}
      </div>
      {msg && <div className={msg.ok ? "note" : "err"} style={{ marginTop: 10 }}>{msg.text}</div>}
      <div className="tablewrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              {canDelete && (
                <th style={{ width: 36 }}>
                  {students.length > 0 && (
                    <input type="checkbox" aria-label="Tick all students" checked={allPicked} onChange={toggleAll} style={{ width: "auto" }} />
                  )}
                </th>
              )}
              <th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                {canDelete && (
                  <td>
                    {p.role === "student" && (
                      <input
                        type="checkbox"
                        aria-label={`Tick ${p.full_name}`}
                        checked={picked.has(p.id)}
                        onChange={() => toggle(p.id)}
                        style={{ width: "auto" }}
                      />
                    )}
                  </td>
                )}
                <td>{p.full_name}{p.id === ownerId ? " · owner" : ""}</td>
                <td>{p.email}</td>
                <td>{ROLE_LABEL[p.role]}</td>
                <td>{fmtDate(p.created_at)}</td>
                <td>{p.active ? "active" : "disabled"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canDelete && students.length > 0 && (
        <p className="tiny muted" style={{ marginTop: 8 }}>
          Tick students to delete their accounts for good. Teachers and administrators cannot be deleted here.
        </p>
      )}
    </div>
  );
}
