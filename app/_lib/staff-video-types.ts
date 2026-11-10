/**
 * Teacher videos: videos that only teachers and administrators can add and
 * watch. Students never see them.
 * Shared by the server and the upload screen, so nothing here is secret.
 */
export type StaffVideo = {
  id: string;
  title: string;
  note: string;
  /** file name inside the course's videos folder, e.g. "<id>.mp4" */
  file: string;
  type: string;
  size: number;
  added: string;
  /** the uploader's name, as shown under the video */
  by: string;
  /** the uploader's profile id: they, and administrators, may rename or delete it */
  byId?: string;
};

export type StaffVideoIndex = { version: 1; items: StaffVideo[] };

/** What a teacher's browser receives: the video with a short-lived link to play it. */
export type StaffVideoShown = StaffVideo & { src: string };

/**
 * Largest video the upload screen accepts, in MB. Supabase's free plan stops at
 * 50 MB a file; on a paid plan, raise the limit in Supabase and set
 * NEXT_PUBLIC_VIDEO_MAX_MB in Vercel to match.
 */
export const VIDEO_MAX_MB = Number(process.env.NEXT_PUBLIC_VIDEO_MAX_MB) > 0 ? Number(process.env.NEXT_PUBLIC_VIDEO_MAX_MB) : 50;

/** Video types that play in Chrome, Edge, Safari and Firefox, by file ending. */
export const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export const videoExt = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

export const isVideoId = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);

/** 52_428_800 → "50 MB" */
export function megabytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return mb >= 100 ? `${Math.round(mb)} MB` : mb >= 1 ? `${mb.toFixed(1).replace(/\.0$/, "")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
