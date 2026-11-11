import { NextResponse } from "next/server";
import { currentProfile } from "@/app/_lib/supabase";
import {
  canManage,
  filesOf,
  loadSets,
  removeFiles,
  saveSets,
  uploadLink,
  uploadedSize,
  videoCourses,
} from "@/app/_lib/staff-videos";
import {
  MAX_CLIPS,
  MAX_SETS,
  VIDEO_MAX_MB,
  parseRefs,
  VIDEO_TYPES,
  isVideoId,
  megabytes,
  parseVideoLink,
  videoExt,
  type Clip,
  type VideoSet,
} from "@/app/_lib/staff-video-types";

/**
 * Recorded lectures, for teachers and administrators only (students are refused).
 * A course holds up to six lectures, each a title with up to three videos.
 *   POST { step: "start", courseId, setId?, name, size }   → a link to upload one file to
 *   POST { step: "save", courseId, setId?, title?, note?, clips }
 *        → a new title with its videos, or more videos for an existing title.
 *          clips: [{ kind: "file", id, file, label } | { kind: "link", url, label }]
 *   POST { step: "discard", courseId, files }             → removes uploads that were never saved
 *   PATCH { courseId, setId, title, note, refs?, labels?, order? } → renames, relabels, reorders, sets the references
 *   DELETE { courseId, setId, clipId? }                   → removes one video, or the title and all its videos
 * A teacher may add titles only to a course they teach, and change or delete
 * only the titles they added. An administrator may do all of it for any course.
 * Files go straight from the browser to storage, because Vercel cannot carry a
 * request larger than a few MB.
 */
async function staff(body: any) {
  const profile = await currentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "teacher")) {
    return { error: NextResponse.json({ error: "Only teachers and administrators can add or change recorded lectures." }, { status: 403 }) };
  }
  const courseId = typeof body?.courseId === "string" ? body.courseId : "";
  const allowed = courseId ? (await videoCourses(profile)).some((c) => c.id === courseId) : false;
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: profile.role === "admin" ? "Choose a course for the video." : "You can add videos only to a course you teach." },
        { status: courseId ? 403 : 400 }
      ),
    };
  }
  return { profile, courseId };
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const NOT_YOURS = "Only the teacher who added this lecture, or an administrator, can change it.";
const FULL = `A lecture can hold up to ${MAX_CLIPS} videos.`;
const COURSE_FULL = `This course already has ${MAX_SETS} recorded lectures, the most it can hold. Delete one to add another.`;
const GONE = "That lecture is no longer there. Reload the page.";
const UNREADABLE = "The video list could not be read just now. Please try again.";

/** "<uuid>.mp4" → true */
const isUploadName = (file: unknown): file is string =>
  typeof file === "string" && !!VIDEO_TYPES[videoExt(file)] && isVideoId(file.slice(0, -(videoExt(file).length + 1)));

async function load(courseId: string) {
  try {
    return await loadSets(courseId, true);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const found = await staff(body);
  if (found.error) return found.error;
  const { profile, courseId } = found;

  if (body?.step === "start") {
    // check there is room before anything is uploaded
    const sets = await load(courseId);
    if (!sets) return fail(UNREADABLE, 500);
    if (body?.setId) {
      const set = sets.find((s) => s.id === body.setId);
      if (!set) return fail(GONE, 404);
      if (!canManage(profile, set)) return fail(NOT_YOURS, 403);
      if (set.clips.length >= MAX_CLIPS) return fail(FULL, 409);
    } else if (sets.length >= MAX_SETS) {
      return fail(COURSE_FULL, 409);
    }
    const ext = videoExt(String(body?.name ?? ""));
    if (!VIDEO_TYPES[ext]) return fail("Choose an MP4, WebM or MOV video file.");
    const size = Number(body?.size);
    if (!Number.isFinite(size) || size <= 0) return fail("That file is empty.");
    if (size > VIDEO_MAX_MB * 1024 * 1024) {
      return fail(`That video is ${megabytes(size)}. Files can be up to ${VIDEO_MAX_MB} MB; add a bigger video as a link instead.`, 413);
    }
    const id = crypto.randomUUID();
    const file = `${id}.${ext}`;
    const { data, error } = await uploadLink(courseId, file);
    if (error || !data) {
      console.error("teacher videos: upload link", error);
      return fail("The upload could not be started. Please try again.", 500);
    }
    return NextResponse.json({ id, file, path: data.path, token: data.token, url: data.signedUrl, type: VIDEO_TYPES[ext] });
  }

  if (body?.step === "save") {
    const input: any[] = Array.isArray(body?.clips) ? body.clips : [];
    if (!input.length) return fail("Add at least one video.");
    if (input.length > MAX_CLIPS) return fail(FULL);

    const sets = await load(courseId);
    if (!sets) return fail(UNREADABLE, 500);
    const used = new Set(sets.flatMap((s) => s.clips.map((c) => c.id)));

    let set: VideoSet | undefined;
    if (body?.setId) {
      set = sets.find((s) => s.id === body.setId);
      if (!set) return fail(GONE, 404);
      if (!canManage(profile, set)) return fail(NOT_YOURS, 403);
      if (set.clips.length + input.length > MAX_CLIPS) {
        const room = MAX_CLIPS - set.clips.length;
        return fail(room > 0 ? `This lecture has room for ${room} more video${room === 1 ? "" : "s"}.` : FULL, 409);
      }
    } else if (sets.length >= MAX_SETS) {
      return fail(COURSE_FULL, 409);
    }

    const now = new Date().toISOString();
    const clips: Clip[] = [];
    for (const [i, c] of input.entries()) {
      const which = input.length > 1 ? `Video ${i + 1}: ` : "";
      const label = clean(c?.label, 80);
      if (c?.kind === "file") {
        const id = c?.id;
        const file = c?.file;
        if (!isVideoId(id) || !isUploadName(file) || !file.startsWith(id + ".")) return fail(`${which}that upload is not recognised.`);
        // a video already on the list belongs to whoever added it; it cannot be claimed again
        if (used.has(id) || clips.some((x) => x.id === id)) return fail(`${which}that video is already on the list.`, 409);
        const size = await uploadedSize(courseId, file);
        if (size == null) return fail(`${which}the video did not arrive in storage. Please upload it again.`);
        clips.push({ id, kind: "file", label, file, type: VIDEO_TYPES[videoExt(file)], size, added: now });
      } else if (c?.kind === "link") {
        const link = parseVideoLink(String(c?.url ?? ""));
        if ("error" in link) return fail(which + link.error);
        clips.push({ id: crypto.randomUUID(), kind: "link", label, ...link, added: now });
      } else {
        return fail(`${which}choose a file or paste a link.`);
      }
    }

    let title = "";
    if (set) {
      set.clips.push(...clips);
    } else {
      title = clean(body?.title, 120);
      if (!title) return fail("Give the lecture a title.");
      sets.push({
        id: crypto.randomUUID(),
        title,
        note: clean(body?.note, 500),
        refs: parseRefs(body?.refs),
        clips,
        added: now,
        by: profile.full_name,
        byId: profile.id,
      });
    }
    const { error } = await saveSets(courseId, sets);
    if (error) {
      console.error("teacher videos: save list", error);
      return fail("The videos were uploaded but could not be added to the list. Please try again.", 500);
    }
    return NextResponse.json({ ok: true, title: set?.title ?? title });
  }

  if (body?.step === "discard") {
    // uploads from a save that did not finish; anything already on the list is kept
    const files: string[] = (Array.isArray(body?.files) ? body.files : []).filter(isUploadName).slice(0, MAX_CLIPS);
    const sets = await load(courseId);
    if (!sets) return NextResponse.json({ ok: true });
    const listed = new Set(filesOf(sets));
    await removeFiles(courseId, files.filter((f) => !listed.has(f)));
    return NextResponse.json({ ok: true });
  }

  return fail("Unknown request.");
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const found = await staff(body);
  if (found.error) return found.error;
  const sets = await load(found.courseId);
  if (!sets) return fail(UNREADABLE, 500);
  const set = sets.find((s) => s.id === body?.setId);
  if (!set) return fail(GONE, 404);
  if (!canManage(found.profile, set)) return fail(NOT_YOURS, 403);

  const title = clean(body?.title, 120);
  if (!title) return fail("Give the lecture a title.");
  set.title = title;
  set.note = clean(body?.note, 500);
  // the reference list, when the form sends one (one reference per line)
  if (body?.refs !== undefined) set.refs = parseRefs(body.refs);

  const labels = body?.labels && typeof body.labels === "object" ? body.labels : {};
  for (const c of set.clips) if (typeof labels[c.id] === "string") c.label = clean(labels[c.id], 80);

  // a new order must name every video of the title exactly once
  const order: unknown[] = Array.isArray(body?.order) ? body.order : [];
  if (order.length === set.clips.length && new Set(order).size === order.length) {
    const byId = new Map(set.clips.map((c) => [c.id, c]));
    if (order.every((id) => typeof id === "string" && byId.has(id))) set.clips = order.map((id) => byId.get(id as string)!);
  }

  const { error } = await saveSets(found.courseId, sets);
  if (error) return fail("The change could not be saved. Please try again.", 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const found = await staff(body);
  if (found.error) return found.error;
  const sets = await load(found.courseId);
  if (!sets) return fail(UNREADABLE, 500);
  const set = sets.find((s) => s.id === body?.setId);
  if (!set) return NextResponse.json({ ok: true });
  if (!canManage(found.profile, set)) return fail(NOT_YOURS, 403);

  let gone: Clip[];
  let next: VideoSet[];
  if (body?.clipId) {
    gone = set.clips.filter((c) => c.id === body.clipId);
    if (!gone.length) return NextResponse.json({ ok: true });
    set.clips = set.clips.filter((c) => c.id !== body.clipId);
    // a lecture with no videos left goes too
    next = set.clips.length ? sets : sets.filter((s) => s.id !== set.id);
  } else {
    gone = set.clips;
    next = sets.filter((s) => s.id !== set.id);
  }

  const { error } = await saveSets(found.courseId, next);
  if (error) return fail("The video could not be removed. Please try again.", 500);
  await removeFiles(found.courseId, gone.flatMap((c) => (c.kind === "file" ? [c.file] : [])));
  return NextResponse.json({ ok: true });
}
