"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";

export default function CompleteButton({
  lessonId,
  studentId,
  done,
}: {
  lessonId: string;
  studentId: string;
  done: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="card">
        <p className="small muted" style={{ margin: 0 }}>✓ Completed.</p>
      </div>
    );
  }

  async function mark() {
    setBusy(true);
    setError(null);
    const supabase = browserClient();
    const { error: e } = await supabase
      .from("lesson_progress")
      .insert({ lesson_id: lessonId, student_id: studentId });
    if (e && !e.message.includes("duplicate")) {
      setBusy(false);
      setError(e.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card">
      <button className="btn block" onClick={mark} disabled={busy}>
        {busy ? "Saving…" : "Mark as complete"}
      </button>
      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
