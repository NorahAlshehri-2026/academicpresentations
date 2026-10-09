"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";

/**
 * One tap shares a recording with a classmate; tapping again stops sharing.
 * The database checks that the recording is yours and that the classmate is
 * in the same class, so nothing here has to be trusted.
 */
export default function SharePanel({
  submissionId,
  classmates,
  sharedWith,
}: {
  submissionId: string;
  classmates: { id: string; full_name: string }[];
  sharedWith: string[];
}) {
  const router = useRouter();
  const [shared, setShared] = useState(new Set(sharedWith));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string) {
    setBusy(id);
    setError(null);
    const supabase = browserClient();
    if (shared.has(id)) {
      const { error: e } = await supabase
        .from("submission_shares")
        .delete()
        .eq("submission_id", submissionId)
        .eq("shared_with", id);
      if (e) setError("That could not be changed. Reload the page and try again.");
      else {
        const next = new Set(shared);
        next.delete(id);
        setShared(next);
      }
    } else {
      const { error: e } = await supabase
        .from("submission_shares")
        .insert({ submission_id: submissionId, shared_with: id });
      if (e && !e.message.includes("duplicate")) {
        setError("That classmate could not be added. They may have left the class.");
      } else {
        setShared(new Set(shared).add(id));
      }
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="sep">
      <h3 style={{ fontSize: 14 }}>Share with a classmate</h3>
      <p className="tiny muted" style={{ marginTop: 4 }}>
        Tap <b>Share</b> and this recording appears on their <b>Shared with me</b> page, ready for them to
        score. Your teacher can already hear all your recordings.
      </p>
      {classmates.length ? (
        <div style={{ marginTop: 6 }}>
          {classmates.map((p) => {
            const on = shared.has(p.id);
            return (
              <div className="mate" key={p.id}>
                <b className="small grow">{p.full_name}</b>
                <button
                  type="button"
                  className={`btn sm ${on ? "ghost" : "gold"}`}
                  onClick={() => toggle(p.id)}
                  disabled={busy === p.id}
                  aria-pressed={on}
                >
                  {busy === p.id ? "…" : on ? "Shared ✓" : "Share"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="small muted" style={{ marginTop: 8 }}>Nobody else has joined your class yet.</p>
      )}
      {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
