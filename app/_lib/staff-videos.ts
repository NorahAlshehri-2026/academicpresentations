import "server-only";
import { adminClient, serverClient, type Profile } from "./supabase";
import { isVideoId, type StaffVideo, type StaffVideoIndex, type StaffVideoShown } from "./staff-video-types";

/**
 * Teacher videos are for teachers and administrators only, so a student must
 * never be able to open one, even with a direct link.
 *
 * They are kept in the "media" bucket under the all-zero folder, beside the
 * answer key. The storage rules on "media" let a student read only files under
 * a course they are enrolled in, and a teacher only under a course they own or
 * teach, so no one can open this folder with their own sign-in. The server
 * reads and writes it with the service key, and the Teacher videos page hands
 * out short-lived links only to the teachers of that course and to
 * administrators.
 *
 * Teachers add videos to the courses they teach; administrators to any
 * course. Whoever added a video, and any administrator, can rename or delete it.
 *
 *   media/00000000-0000-0000-0000-000000000000/<course_id>/videos/index.json
 *   media/00000000-0000-0000-0000-000000000000/<course_id>/videos/<id>.mp4 …
 */
const STAFF_ONLY = "00000000-0000-0000-0000-000000000000";
const BUCKET = "media";
const PLAY_FOR = 4 * 60 * 60; // seconds a playback link stays valid

export const videoDir = (courseId: string) => `${STAFF_ONLY}/${courseId}/videos`;
const indexPath = (courseId: string) => `${videoDir(courseId)}/index.json`;

const store = () => adminClient().storage.from(BUCKET);

/** The course's videos, newest first. An unreadable or missing list is an empty one. */
export async function loadVideos(courseId: string): Promise<StaffVideo[]> {
  try {
    const { data } = await store().download(indexPath(courseId));
    if (!data) return [];
    const parsed = JSON.parse(await data.text()) as Partial<StaffVideoIndex>;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return items
      .filter((v) => v && isVideoId(v.id) && typeof v.file === "string" && typeof v.title === "string")
      .sort((a, b) => (a.added < b.added ? 1 : -1));
  } catch {
    return [];
  }
}

export async function saveVideos(courseId: string, items: StaffVideo[]) {
  const index: StaffVideoIndex = { version: 1, items };
  const body = new Blob([JSON.stringify(index)], { type: "application/json" });
  return store().upload(indexPath(courseId), body, { contentType: "application/json", cacheControl: "0", upsert: true });
}

/** A link the uploader's browser can send the file to directly (Vercel cannot carry large files). */
export async function uploadLink(courseId: string, file: string) {
  return store().createSignedUploadUrl(`${videoDir(courseId)}/${file}`);
}

/** The size of an uploaded file, or null if it is not there. */
export async function uploadedSize(courseId: string, file: string): Promise<number | null> {
  const { data } = await store().list(videoDir(courseId), { search: file, limit: 10 });
  const hit = (data ?? []).find((f) => f.name === file);
  if (!hit) return null;
  const size = Number((hit.metadata as any)?.size);
  return Number.isFinite(size) ? size : 0;
}

export async function removeFile(courseId: string, file: string) {
  return store().remove([`${videoDir(courseId)}/${file}`]);
}

/** The same videos, each with a link that plays it for the next few hours. */
export async function withLinks(courseId: string, items: StaffVideo[]): Promise<StaffVideoShown[]> {
  if (!items.length) return [];
  const { data } = await store().createSignedUrls(
    items.map((v) => `${videoDir(courseId)}/${v.file}`),
    PLAY_FOR
  );
  return items.map((v, i) => ({ ...v, src: data?.[i]?.signedUrl ?? "" }));
}

/**
 * The courses whose teacher videos this person may watch: every course for an
 * administrator; for a teacher, the courses they own or have a class in.
 * Students get none. Read with the person's own sign-in, so the database rules
 * decide what they can see.
 */
export async function videoCourses(profile: Profile): Promise<{ id: string; title: string }[]> {
  if (profile.role === "student") return [];
  const supabase = serverClient();
  if (profile.role === "admin") {
    const { data } = await supabase.from("courses").select("id, title").order("created_at");
    return (data ?? []) as { id: string; title: string }[];
  }
  const [{ data: sections }, { data: owned }] = await Promise.all([
    supabase.from("sections").select("courses(id, title)").eq("teacher_id", profile.id),
    supabase.from("courses").select("id, title").eq("owner_id", profile.id),
  ]);
  const found = new Map<string, { id: string; title: string }>();
  for (const s of (sections ?? []) as any[]) {
    const c = Array.isArray(s.courses) ? s.courses[0] : s.courses;
    if (c?.id) found.set(c.id, { id: c.id, title: c.title });
  }
  for (const c of (owned ?? []) as any[]) found.set(c.id, { id: c.id, title: c.title });
  return Array.from(found.values()).sort((a, b) => a.title.localeCompare(b.title));
}

/** Whoever added a video may rename or delete it; administrators may change any. */
export function canManage(profile: Profile, video: { byId?: string }) {
  return profile.role === "admin" || (profile.role === "teacher" && !!video.byId && video.byId === profile.id);
}
