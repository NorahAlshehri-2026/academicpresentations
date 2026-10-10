"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";

/**
 * Deletes an attempt and its file. Students may delete only attempt 1; the
 * database also lets an administrator clear any unmarked attempt (for example
 * a recording that saved empty), after which the student can record it again.
 */
export default function DeleteAttempt({
  submissionId,
  filePath,
  label = "Delete attempt 1",
  confirmText = "Delete attempt 1 for good? Any feedback on it is deleted too.",
  after,
}: {
  submissionId: string;
  filePath: string | null;
  label?: string;
  confirmText?: string;
  /** where to go once it is deleted; by default the page just reloads */
  after?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const supabase = browserClient();
    const { data, error: e } = await supabase.from("submissions").delete().eq("id", submissionId).select("id");
    if (e || !data?.length) {
      setBusy(false);
      setError(e ? e.message : "This attempt cannot be deleted. It may already have an official mark.");
      return;
    }
    // only the owner may remove the file itself; for anyone else this quietly does nothing
    if (filePath) await supabase.storage.from("recordings").remove([filePath]);
    if (after) router.push(after);
    else router.refresh();
  }

  return (
    <>
      <button type="button" className="btn ghost sm" onClick={remove} disabled={busy}>
        {busy ? "Deleting…" : label}
      </button>
      {error && <div className="err" style={{ marginTop: 10, width: "100%" }}>{error}</div>}
    </>
  );
}
