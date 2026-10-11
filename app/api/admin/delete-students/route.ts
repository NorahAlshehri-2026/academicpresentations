import { NextResponse } from "next/server";
import { currentProfile, serverClient, adminClient } from "@/app/_lib/supabase";

/**
 * Deletes student accounts for good: the sign-in, the profile, and everything
 * the student made (class memberships, recordings and their files, feedback
 * they gave or received, marks, progress).
 *
 * Only the academy owner may do this, and only to accounts whose role is
 * student; teachers and administrators cannot be deleted here.
 */
export async function POST(req: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isOwner } = await serverClient().rpc("is_owner");
  if (!isOwner) return NextResponse.json({ error: "Only the academy owner can delete accounts." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (!ids.length) return NextResponse.json({ error: "No accounts chosen." }, { status: 400 });

  const db = adminClient();
  const { data: targets } = await db.from("profiles").select("id, full_name, role").in("id", ids);
  const students = ((targets ?? []) as any[]).filter((p) => p.role === "student" && p.id !== profile.id);

  const deleted: string[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const st of students) {
    try {
      const { data: subs } = await db.from("submissions").select("id, file_path").eq("student_id", st.id);
      const subIds = ((subs ?? []) as any[]).map((s) => s.id);
      const files = ((subs ?? []) as any[]).map((s) => s.file_path).filter(Boolean);

      const must = async (p: PromiseLike<{ error: any }>) => {
        const { error } = await p;
        if (error) throw new Error(error.message);
      };
      // tables whose exact columns vary between versions: try, and carry on if a column is absent
      const may = async (p: PromiseLike<{ error: any }>) => { await p; };

      if (subIds.length) {
        await must(db.from("submission_shares").delete().in("submission_id", subIds));
        await must(db.from("grades").delete().in("submission_id", subIds));
        await must(db.from("feedback").delete().in("submission_id", subIds));
      }
      await must(db.from("submission_shares").delete().or(`shared_with.eq.${st.id},shared_by.eq.${st.id}`));
      await must(db.from("feedback").delete().eq("author_id", st.id));
      await must(db.from("submissions").delete().eq("student_id", st.id));
      await must(db.from("enrolments").delete().eq("student_id", st.id));
      await may(db.from("lesson_progress").delete().eq("student_id", st.id));
      await may(db.from("quiz_responses").delete().eq("student_id", st.id));
      await may(db.from("question_answers").delete().eq("student_id", st.id));

      if (files.length) await db.storage.from("recordings").remove(files);

      const { error: authErr } = await db.auth.admin.deleteUser(st.id);
      if (authErr) throw new Error(authErr.message);
      // the profile normally goes with the sign-in; make sure
      await may(db.from("profiles").delete().eq("id", st.id));

      deleted.push(st.full_name);
    } catch (e: any) {
      failed.push({ name: st.full_name, error: e?.message ?? String(e) });
    }
  }

  return NextResponse.json({ deleted, failed }, { status: failed.length && !deleted.length ? 500 : 200 });
}
