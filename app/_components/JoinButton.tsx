"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";

export default function JoinButton({
  sectionId,
  studentId,
  courseId,
}: {
  sectionId: string;
  studentId: string;
  courseId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const supabase = browserClient();
    const { error: e } = await supabase
      .from("enrolments")
      .insert({ section_id: sectionId, student_id: studentId, status: "active" });

    if (e) {
      setBusy(false);
      setError(
        e.message.includes("row-level security")
          ? "This class is not accepting new students at the moment."
          : e.message
      );
      return;
    }
    router.push(`/activities`);
    router.refresh();
  }

  return (
    <>
      <button className="btn gold block" style={{ marginTop: 16 }} onClick={join} disabled={busy}>
        {busy ? "Joining…" : "Join this class"}
      </button>
      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </>
  );
}
