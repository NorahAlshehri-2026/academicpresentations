import "server-only";
import { adminClient, serverClient, type Profile } from "./supabase";
import {
  KEEP_MAX,
  NEW_FOR_MS,
  type Announcement,
  type AnnouncementShown,
  type SectionChoice,
} from "./announcement-types";

/**
 * Announcements from teachers and administrators to students.
 *
 *   A teacher posts to one or more of their own classes.
 *   An administrator posts to any class, or to everyone in the academy.
 *   Students see the ones for the classes they are in (and the academy-wide
 *   ones) at the top of their Home page, until they end or are removed.
 *   Whoever posted one, and any administrator, can change or remove it.
 *
 * The list is one small file in the "media" bucket, under the all-zero folder
 * beside the answer key and the recorded lectures. The storage rules give no
 * one access to that folder with their own sign-in, so the server reads and
 * writes it with the service key and hands each person only what is theirs.
 * No database change is needed.
 *
 *   media/00000000-0000-0000-0000-000000000000/announcements/index.json
 */
const STAFF_ONLY = "00000000-0000-0000-0000-000000000000";
const BUCKET = "media";
const INDEX = `${STAFF_ONLY}/announcements/index.json`;

const store = () => adminClient().storage.from(BUCKET);

const notFound = (error: any) =>
  !!error &&
  (Number(error.status) === 404 ||
    String(error.statusCode) === "404" ||
    /not.?found|does not exist/i.test(String(error.message ?? "")));

const valid = (a: any): a is Announcement =>
  !!a &&
  typeof a.id === "string" &&
  typeof a.title === "string" &&
  typeof a.body === "string" &&
  (a.audience === "all" || a.audience === "sections") &&
  Array.isArray(a.sections) &&
  typeof a.posted === "string";

/**
 * Every announcement, newest first.
 * strict: throw if the list exists but cannot be read, so a save never
 * replaces a list it could not see. Otherwise an unreadable list shows as empty.
 */
export async function loadAnnouncements(strict = false): Promise<Announcement[]> {
  let data: Blob | null = null;
  let error: any = null;
  try {
    ({ data, error } = await store().download(INDEX));
  } catch (e) {
    if (strict) throw e;
    return [];
  }
  if (error || !data) {
    if (!error || notFound(error) || !strict) return [];
    throw new Error(`announcements: could not read the list (${error.message})`);
  }
  let parsed: any;
  try {
    parsed = JSON.parse(await data.text());
  } catch {
    if (strict) throw new Error("announcements: the list is not valid JSON");
    return [];
  }
  const items: Announcement[] = Array.isArray(parsed?.items) ? parsed.items.filter(valid) : [];
  return items.sort((a, b) => b.posted.localeCompare(a.posted));
}

export async function saveAnnouncements(items: Announcement[]) {
  // keep the newest; when there are too many, drop the oldest that have ended first
  let list = [...items].sort((a, b) => b.posted.localeCompare(a.posted));
  if (list.length > KEEP_MAX) {
    const now = Date.now();
    const ended = list.filter((a) => a.until && new Date(a.until).getTime() < now);
    const drop = new Set(ended.slice(-(list.length - KEEP_MAX)).map((a) => a.id));
    list = list.filter((a) => !drop.has(a.id)).slice(0, KEEP_MAX);
  }
  const body = new Blob([JSON.stringify({ version: 1, items: list })], { type: "application/json" });
  return store().upload(INDEX, body, { contentType: "application/json", cacheControl: "0", upsert: true });
}

const ended = (a: Announcement, now = Date.now()) => !!a.until && new Date(a.until).getTime() < now;

/**
 * The classes this person may post to: a teacher's own classes; every class
 * for an administrator. Read with the person's own sign-in.
 */
export async function postableSections(profile: Profile): Promise<SectionChoice[]> {
  if (profile.role === "student") return [];
  const supabase = serverClient();
  let q = supabase.from("sections").select("id, number, term, teacher_id, courses(title)").order("number");
  if (profile.role === "teacher") q = q.eq("teacher_id", profile.id);
  const { data } = await q;
  return ((data ?? []) as any[]).map((s) => {
    const c = Array.isArray(s.courses) ? s.courses[0] : s.courses;
    return { id: s.id, label: `Section ${s.number}`, course: c?.title ?? "", term: s.term ?? "" };
  });
}

/** The classes a teacher or administrator teaches themselves. */
export async function taughtSectionIds(profile: Profile): Promise<string[]> {
  if (profile.role === "student") return [];
  const { data } = await serverClient().from("sections").select("id").eq("teacher_id", profile.id);
  return ((data ?? []) as any[]).map((s) => s.id);
}

async function studentSectionIds(studentId: string): Promise<string[]> {
  const { data } = await serverClient()
    .from("enrolments")
    .select("section_id")
    .eq("student_id", studentId)
    .eq("status", "active");
  return ((data ?? []) as any[]).map((e) => e.section_id);
}

function toLabel(a: Announcement, labels: Map<string, string>, forStudent: boolean) {
  if (a.audience === "all") return "Everyone in the academy";
  if (forStudent) return "Your class";
  const names = a.sections.map((id) => labels.get(id) ?? "another class");
  const nums = names.filter((n) => n.startsWith("Section ")).map((n) => n.slice(8));
  const other = names.filter((n) => !n.startsWith("Section "));
  const parts = [nums.length ? `Section${nums.length === 1 ? "" : "s"} ${nums.join(", ")}` : "", ...Array.from(new Set(other))];
  return parts.filter(Boolean).join(", ");
}

function shown(
  a: Announcement,
  viewer: Profile | null,
  labels: Map<string, string>,
  forStudent: boolean,
  now = Date.now()
): AnnouncementShown {
  return {
    ...a,
    to: toLabel(a, labels, forStudent),
    ended: ended(a, now),
    isNew: now - new Date(a.posted).getTime() < NEW_FOR_MS,
    canEdit:
      !forStudent && !!viewer && (viewer.role === "admin" || (viewer.role === "teacher" && a.byId === viewer.id)),
  };
}

/** What a student sees: live announcements for their classes and for everyone. */
export async function announcementsForStudent(profile: Profile): Promise<AnnouncementShown[]> {
  const [all, mine] = await Promise.all([loadAnnouncements(), studentSectionIds(profile.id)]);
  const set = new Set(mine);
  const now = Date.now();
  return all
    .filter((a) => !ended(a, now))
    .filter((a) => a.audience === "all" || (mine.length > 0 && a.sections.some((s) => set.has(s))))
    .map((a) => shown(a, null, new Map(), true, now));
}

/**
 * The student preview: what this teacher's or administrator's own students
 * would see (academy-wide posts and posts to the classes they teach).
 */
export async function announcementsForPreview(profile: Profile): Promise<AnnouncementShown[]> {
  const [all, taught] = await Promise.all([loadAnnouncements(), taughtSectionIds(profile)]);
  const set = new Set(taught);
  const now = Date.now();
  return all
    .filter((a) => !ended(a, now))
    .filter((a) => a.audience === "all" || a.sections.some((s) => set.has(s)))
    .map((a) => shown(a, null, new Map(), true, now));
}

/**
 * The staff list on Home: an administrator sees every announcement; a teacher
 * sees their own, those to their classes, and the academy-wide ones. Ended ones
 * are included (marked), so they can be posted again or removed.
 */
export async function announcementsForStaff(
  profile: Profile,
  sections: SectionChoice[]
): Promise<AnnouncementShown[]> {
  const all = await loadAnnouncements();
  const labels = new Map(sections.map((s) => [s.id, s.label]));
  const mine = new Set(sections.map((s) => s.id));
  const now = Date.now();
  return all
    .filter(
      (a) =>
        profile.role === "admin" ||
        a.byId === profile.id ||
        a.audience === "all" ||
        a.sections.some((s) => mine.has(s))
    )
    .map((a) => shown(a, profile, labels, false, now));
}

/** Whoever posted an announcement may change or remove it; administrators may change any. */
export const canChange = (profile: Profile, a: Announcement) =>
  profile.role === "admin" || (profile.role === "teacher" && a.byId === profile.id);

/** A sample for the student preview when nothing has been posted yet. */
export function sampleAnnouncement(teacherName: string): AnnouncementShown {
  const posted = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  return {
    id: "sample",
    title: "Welcome to the course",
    body:
      "Welcome, everyone. This week, read Unit 1 and record the Sixty-second opening. " +
      "Share your recording with one classmate and give feedback on theirs.",
    audience: "sections",
    sections: [],
    by: teacherName,
    byId: "",
    byRole: "teacher",
    posted,
    until: null,
    to: "Your class",
    ended: false,
    isNew: true,
    canEdit: false,
  };
}
