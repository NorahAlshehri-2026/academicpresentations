"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";

/** Deletes attempt 1 and its file. The database refuses it for attempt 2. */
export default function DeleteAttempt({ submissionId, filePath }: { submissionId: string; filePath: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete attempt 1 for good? Any feedback on it is deleted too.")) return;
    setBusy(true);
    setError(null);
    const supabase = browserClient();
    const { data, error: e } = await supabase.from("submissions").delete().eq("id", submissionId).select("id");
    if (e || !data?.length) {
      setBusy(false);
      setError(e ? e.message : "This attempt cannot be deleted. It may already have an official mark.");
      return;
    }
    if (filePath) await supabase.storage.from("recordings").remove([filePath]);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn ghost sm" onClick={remove} disabled={busy}>
        {busy ? "Deleting…" : "Delete attempt 1"}
      </button>
      {error && <div className="err" style={{ marginTop: 10, width: "100%" }}>{error}</div>}
    </>
  );
}
