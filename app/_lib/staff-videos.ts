import "server-only";
import { adminClient, serverClient, type Profile } from "./supabase";
import {
  embedSrc,
  isVideoId,
  type Clip,
  type ClipShown,
  type StaffVideoIndex,
  type VideoSet,
  type VideoSetShown,
} from "./staff-video-types";

/**
 * Teacher videos are for teachers and administrators only, so a student must
 * never be able to open one, even with a direct link.
 *
 * The list and the uploaded files are kept in the "media" bucket under the
 * all-zero folder, beside the answer key. The storage rules on "media" let a
 * student read only files under a course they are enrolled in, and a teacher
 * only under a course they own or teach, so no one can open this folder with
 * their own sign-in. The server reads and writes it with the service key, and
 * the Teacher videos page hands out short-lived links only to the teachers of
 * that course and to administrators. Linked videos (YouTube, Google Drive …)
 * are listed only on that page too.
 *
 * Videos are grouped under titles, up to three videos a title. Teachers add
 * titles to the courses they teach; administrators to any course. Whoever
 * added a title, and any administrator, can change or delete it.
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

const notFound = (error: any) =>
  !!error &&
  (Number(error.status) === 404 ||
    String(error.statusCode) === "404" ||
    /not.?found|does not exist/i.test(String(error.message ?? "")));

const validClip = (c: any): c is Clip =>
  !!c &&
  typeof c.id === "string" &&
  ((c.kind === "file" && typeof c.file === "string") || (c.kind === "link" && typeof c.ref === "string" && typeof c.source === "string"));

/** A list saved before titles existed held one video per entry: each becomes a title with one video. */
function fromFirstVersion(items: any[]): VideoSet[] {
  return items
    .filter((v) => v && isVideoId(v.id) && typeof v.file === "string" && typeof v.title === "string")
    .map((v) => ({
      id: v.id,
      title: v.title,
      note: typeof v.note === "string" ? v.note : "",
      added: v.added,
      by: v.by ?? "",
      byId: v.byId,
      clips: [{ id: v.id, kind: "file", label: "", file: v.file, type: v.type, size: Number(v.size) || 0, added: v.added }],
    }));
}

/**
 * The course's titles, in title order (Unit 2 before Unit 10).
 * strict: throw if the list exists but cannot be read, so a save never
 * replaces a list it could not see. Otherwise an unreadable list shows as empty.
 */
export async function loadSets(courseId: string, strict = false): Promise<VideoSet[]> {
  const { data, error } = await store().download(indexPath(courseId));
  if (error || !data) {
    if (!error || notFound(error) || !strict) return [];
    throw new Error(`teacher videos: could not read the list (${error.message})`);
  }
  let parsed: any;
  try {
    parsed = JSON.parse(await data.text());
  } catch {
    if (strict) throw new Error("teacher videos: the list is not valid JSON");
    return [];
  }
  const sets: VideoSet[] = Array.isArray(parsed?.sets)
    ? parsed.sets
        .filter((s: any) => s && typeof s.id === "string" && typeof s.title === "string" && Array.isArray(s.clips))
        .map((s: any) => ({
          ...s,
          note: typeof s.note === "string" ? s.note : "",
          refs: Array.isArray(s.refs) ? s.refs.filter((r: unknown) => typeof r === "string") : [],
          clips: s.clips.filter(validClip),
        }))
        .filter((s: VideoSet) => s.clips.length > 0)
    : Array.isArray(parsed?.items)
      ? fromFirstVersion(parsed.items)
      : [];
  return sets.sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true, sensitivity: "base" }));
}

export async function saveSets(courseId: string, sets: VideoSet[]) {
  const index: StaffVideoIndex = { version: 2, sets };
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

export async function removeFiles(courseId: string, files: string[]) {
  if (!files.length) return { data: [], error: null };
  return store().remove(files.map((f) => `${videoDir(courseId)}/${f}`));
}

/** Every file a list refers to. */
export const filesOf = (sets: VideoSet[]) =>
  sets.flatMap((s) => s.clips.flatMap((c) => (c.kind === "file" ? [c.file] : [])));

/** The same titles, each video with the address that plays it (files: a link valid for a few hours). */
export async function withLinks(courseId: string, sets: VideoSet[]): Promise<VideoSetShown[]> {
  const files = filesOf(sets);
  const signed = new Map<string, string>();
  if (files.length) {
    const { data } = await store().createSignedUrls(
      files.map((f) => `${videoDir(courseId)}/${f}`),
      PLAY_FOR
    );
    files.forEach((f, i) => signed.set(f, data?.[i]?.signedUrl ?? ""));
  }
  return sets.map((s) => ({
    ...s,
    clips: s.clips.map((c): ClipShown => ({ ...c, src: c.kind === "file" ? signed.get(c.file) ?? "" : embedSrc(c) })),
  }));
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

/** Whoever added a title may change or delete it; administrators may change any. */
export function canManage(profile: Profile, set: { byId?: string }) {
  return profile.role === "admin" || (profile.role === "teacher" && !!set.byId && set.byId === profile.id);
}
