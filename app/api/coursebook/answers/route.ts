import { NextResponse } from "next/server";
import { currentProfile } from "@/app/_lib/supabase";
import { loadCourse } from "@/app/_lib/course";
import { cleanAnswerKey, removeAnswerKey, saveAnswerKey } from "@/app/_lib/answer-key";

/** Administrators add, replace (POST) or remove (DELETE) the coursebook's answer key. */
async function adminCourse() {
  const profile = await currentProfile();
  if (!profile || profile.role !== "admin") return { error: NextResponse.json({ error: "Administrators only." }, { status: 403 }) };
  const { course } = await loadCourse();
  if (!course) return { error: NextResponse.json({ error: "There is no course yet." }, { status: 404 }) };
  return { course };
}

export async function POST(request: Request) {
  const found = await adminCourse();
  if (found.error) return found.error;
  const body = await request.json().catch(() => null);
  const key = cleanAnswerKey(body);
  if (!key) {
    return NextResponse.json({ error: "That file has no answers in it. Choose the answer-key.json file." }, { status: 400 });
  }
  const { error } = await saveAnswerKey(found.course.id, key);
  if (error) {
    console.error("answer key: save", error);
    return NextResponse.json({ error: "The answer key could not be saved. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: key.items.length });
}

export async function DELETE() {
  const found = await adminCourse();
  if (found.error) return found.error;
  const { error } = await removeAnswerKey(found.course.id);
  if (error) return NextResponse.json({ error: "The answer key could not be removed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
