import { NextResponse } from "next/server";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { loadVideos, removeFile, saveVideos, uploadLink, uploadedSize } from "@/app/_lib/staff-videos";
import { VIDEO_MAX_MB, VIDEO_TYPES, isVideoId, megabytes, videoExt } from "@/app/_lib/staff-video-types";

/**
 * Teacher videos, administrators only:
 *   POST { step: "start", courseId, name, size }   → a link to upload the file to
 *   POST { step: "finish", courseId, id, file, title, note } → adds it to the list
 *   PATCH { courseId, id, title, note }             → renames it
 *   DELETE { courseId, id }                         → removes it and its file
 * The file goes straight from the browser to storage, because Vercel cannot
 * carry a request larger than a few MB.
 */
async function admin(body: any) {
  const profile = await currentProfile();
  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Only administrators can change teacher videos." }, { status: 403 }) };
  }
  const courseId = typeof body?.courseId === "string" ? body.courseId : "";
  const { data: course } = courseId
    ? await serverClient().from("courses").select("id").eq("id", courseId).maybeSingle()
    : { data: null };
  if (!course) return { error: NextResponse.json({ error: "Choose a course for the video." }, { status: 400 }) };
  return { profile, courseId };
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const found = await admin(body);
  if (found.error) return found.error;
  const { profile, courseId } = found;

  if (body?.step === "start") {
    const ext = videoExt(String(body?.name ?? ""));
    if (!VIDEO_TYPES[ext]) return fail("Choose an MP4, WebM or MOV video file.");
    const size = Number(body?.size);
    if (!Number.isFinite(size) || size <= 0) return fail("That file is empty.");
    if (size > VIDEO_MAX_MB * 1024 * 1024) {
      return fail(`That video is ${megabytes(size)}. The limit is ${VIDEO_MAX_MB} MB a video.`, 413);
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

  if (body?.step === "finish") {
    const id = body?.id;
    const file = typeof body?.file === "string" ? body.file : "";
    if (!isVideoId(id) || !VIDEO_TYPES[videoExt(file)] || file !== `${id}.${videoExt(file)}`) return fail("That upload is not recognised.");
    const title = clean(body?.title, 120);
    if (!title) return fail("Give the video a title.");
    const note = clean(body?.note, 500);
    const size = await uploadedSize(courseId, file);
    if (size == null) return fail("The video did not arrive in storage. Please upload it again.");

    const items = (await loadVideos(courseId)).filter((v) => v.id !== id);
    items.push({ id, title, note, file, type: VIDEO_TYPES[videoExt(file)], size, added: new Date().toISOString(), by: profile.full_name });
    const { error } = await saveVideos(courseId, items);
    if (error) {
      console.error("teacher videos: save list", error);
      return fail("The video was uploaded but could not be added to the list. Please try again.", 500);
    }
    return NextResponse.json({ ok: true });
  }

  return fail("Unknown request.");
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const found = await admin(body);
  if (found.error) return found.error;
  const items = await loadVideos(found.courseId);
  const video = items.find((v) => v.id === body?.id);
  if (!video) return fail("That video is no longer there.", 404);
  const title = clean(body?.title, 120);
  if (!title) return fail("Give the video a title.");
  video.title = title;
  video.note = clean(body?.note, 500);
  const { error } = await saveVideos(found.courseId, items);
  if (error) return fail("The change could not be saved. Please try again.", 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const found = await admin(body);
  if (found.error) return found.error;
  const items = await loadVideos(found.courseId);
  const video = items.find((v) => v.id === body?.id);
  if (!video) return NextResponse.json({ ok: true });
  const { error } = await saveVideos(found.courseId, items.filter((v) => v.id !== video.id));
  if (error) return fail("The video could not be removed. Please try again.", 500);
  await removeFile(found.courseId, video.file);
  return NextResponse.json({ ok: true });
}
