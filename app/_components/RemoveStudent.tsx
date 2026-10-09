"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";

/** Takes a student out of a class. Their recordings and marks are kept. */
export default function RemoveStudent({ sectionId, studentId }: { sectionId: string; studentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm("Remove this student from the class? Their recordings and marks are kept.")) return;
    setBusy(true);
    const supabase = browserClient();
    const { error } = await supabase.from("enrolments").delete().eq("section_id", sectionId).eq("student_id", studentId);
    setBusy(false);
    if (error) window.alert("That could not be done: " + error.message);
    router.refresh();
  }

  return (
    <button type="button" className="btn ghost sm" onClick={remove} disabled={busy}>
      {busy ? "…" : "Remove"}
    </button>
  );
}
