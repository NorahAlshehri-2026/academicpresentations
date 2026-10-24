import "server-only";
import { adminClient } from "./supabase";
import type { CbAnswer, CbAnswerKey } from "./coursebook-types";

/**
 * The answer key is for teachers and administrators only, so it must never
 * reach a student's browser or be readable with a student's sign-in.
 *
 * It is kept in the "media" bucket under a folder named with the all-zero id,
 * which no course has. The storage rules on "media" let a student read only
 * files under a course they are enrolled in, and a teacher only under a course
 * they own or teach, so neither can open it directly. The server reads and
 * writes it with the service key, and the Coursebook page hands it only to
 * teachers and administrators.
 */
const STAFF_ONLY = "00000000-0000-0000-0000-000000000000";
const BUCKET = "media";

export const answerKeyPath = (courseId: string) => `${STAFF_ONLY}/${courseId}/answer-key.json`;

const num = (v: unknown, lo: number, hi: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

/** Accepts anything; returns a key that is safe to store and show, or null. */
export function cleanAnswerKey(input: any): CbAnswerKey | null {
  const raw: any[] = Array.isArray(input?.items) ? input.items : Array.isArray(input) ? input : [];
  const items: CbAnswer[] = [];
  const seen = new Set<string>();
  for (const it of raw.slice(0, 1000)) {
    const page = num(it?.page, 1, 9999);
    const ex = typeof it?.ex === "string" ? it.ex.trim().slice(0, 12) : "";
    const answer = typeof it?.answer === "string" ? it.answer.replace(/\r\n?/g, "\n").trim().slice(0, 6000) : "";
    const b: unknown[] = Array.isArray(it?.box) ? it.box : [];
    const box = b.slice(0, 4).map((v) => num(v, 0, 1));
    if (!page || !ex || !answer || box.length !== 4 || box.some((v) => v == null)) continue;
    const key = `${Math.round(page)}:${ex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ page: Math.round(page), ex, box: box as CbAnswer["box"], answer });
  }
  if (!items.length) return null;
  items.sort((a, b) => a.page - b.page || a.box[1] - b.box[1]);
  return { version: 1, updated: new Date().toISOString(), items };
}

/** The course's answer key, or null if there is none (or it cannot be read). */
export async function loadAnswerKey(courseId: string): Promise<CbAnswerKey | null> {
  try {
    const { data } = await adminClient().storage.from(BUCKET).download(answerKeyPath(courseId));
    if (!data) return null;
    const parsed = JSON.parse(await data.text());
    const key = cleanAnswerKey(parsed);
    return key ? { ...key, updated: typeof parsed?.updated === "string" ? parsed.updated : key.updated } : null;
  } catch {
    return null;
  }
}

export async function saveAnswerKey(courseId: string, key: CbAnswerKey) {
  const body = new Blob([JSON.stringify(key)], { type: "application/json" });
  return adminClient().storage.from(BUCKET).upload(answerKeyPath(courseId), body, {
    contentType: "application/json",
    cacheControl: "0",
    upsert: true,
  });
}

export async function removeAnswerKey(courseId: string) {
  return adminClient().storage.from(BUCKET).remove([answerKeyPath(courseId)]);
}
