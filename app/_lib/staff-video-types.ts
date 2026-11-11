/**
 * Recorded lectures: videos that only teachers and administrators can add and
 * watch. Students never see them; a teacher shows one to a class from the
 * Recorded lectures page with "Show to class".
 *
 * A course holds up to six recorded lectures, and each lecture up to three
 * videos (a lecture is a "set" in the code). Each video is
 * either a file uploaded to the academy's storage (up to the storage limit:
 * 50 MB a file on Supabase's free plan) or a link to a video kept elsewhere
 * (YouTube, Google Drive, Vimeo, OneDrive/SharePoint or a direct MP4 link),
 * which has no size limit.
 *
 * Shared by the server and the browser, so nothing here is secret.
 */

/** The most videos one recorded lecture can hold. */
export const MAX_CLIPS = 3;

/** The most recorded lectures one course can hold. */
export const MAX_SETS = 6;

export type LinkSource = "youtube" | "drive" | "vimeo" | "microsoft" | "direct";

/** A video file kept in the academy's storage. */
export type FileClip = {
  id: string;
  kind: "file";
  /** e.g. "Part 1: the opening"; may be empty */
  label: string;
  /** file name inside the course's videos folder, e.g. "<id>.mp4" */
  file: string;
  type: string;
  size: number;
  added: string;
};

/** A video kept on YouTube, Google Drive, Vimeo, OneDrive/SharePoint or elsewhere. */
export type LinkClip = {
  id: string;
  kind: "link";
  label: string;
  source: LinkSource;
  /** the video's id on that service, or (OneDrive/SharePoint, direct links) the checked address */
  ref: string;
  /** the address to open it on its own site */
  url: string;
  /** seconds into the video to start, from a YouTube link with ?t= */
  start?: number;
  added: string;
};

export type Clip = FileClip | LinkClip;

/** One recorded lecture: its title and its videos (one to three). */
export type VideoSet = {
  id: string;
  title: string;
  note: string;
  clips: Clip[];
  added: string;
  /** the name of the teacher who added the title */
  by: string;
  /** their profile id: they, and administrators, may change or delete it */
  byId?: string;
};

export type StaffVideoIndex = { version: 2; sets: VideoSet[] };

/** What a teacher's browser receives: each video with the address that plays it. */
export type ClipShown = Clip & { src: string };
export type VideoSetShown = Omit<VideoSet, "clips"> & { clips: ClipShown[] };

/**
 * Largest video file the upload screen accepts, in MB. Supabase's free plan
 * stops at 50 MB a file; bigger videos are added as a link instead. On a paid
 * plan, raise the limit in Supabase and set NEXT_PUBLIC_VIDEO_MAX_MB in Vercel
 * to match.
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
  if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace(/\.0$/, "")} GB`;
  return mb >= 100 ? `${Math.round(mb)} MB` : mb >= 1 ? `${mb.toFixed(1).replace(/\.0$/, "")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "Part 1: the opening", or "Video 2" when the video has no label. */
export const clipName = (clip: { label?: string }, index: number) => clip.label?.trim() || `Video ${index + 1}`;

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

export const SOURCE_NAMES: Record<LinkSource, string> = {
  youtube: "YouTube",
  drive: "Google Drive",
  vimeo: "Vimeo",
  microsoft: "OneDrive / SharePoint",
  direct: "Video link",
};

export type ParsedLink = { source: LinkSource; ref: string; url: string; start?: number };

export const LINK_HELP =
  "Paste a YouTube, Google Drive or Vimeo link, a OneDrive/SharePoint embed code, or a direct link to an MP4 file.";

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
const VIMEO_ID = /^\d{5,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/i;

/** "90", "90s", "1m30s", "1h2m3s" → seconds */
function seconds(t: string | null): number | undefined {
  if (!t) return undefined;
  if (/^\d+s?$/.test(t)) return Number(t.replace("s", "")) || undefined;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !m[0]) return undefined;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : undefined;
}

/**
 * Reads a pasted link (or an embed code with an <iframe src="…">) and works
 * out where the video is. Anything that is not a video on a known service, or
 * a direct link to a video file, is refused with a reason a teacher can act on.
 */
export function parseVideoLink(input: string): ParsedLink | { error: string } {
  let text = String(input ?? "").trim();
  if (!text) return { error: "Paste the video's link." };
  const iframe = text.match(/<iframe[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i);
  if (iframe) text = iframe[1].replace(/&amp;/g, "&");
  if (/\s/.test(text)) return { error: LINK_HELP };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = "https://" + text.replace(/^\/+/, "");

  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { error: LINK_HELP };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { error: LINK_HELP };
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  const parts = u.pathname.split("/").filter(Boolean);

  // YouTube
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    let id: string | null | undefined;
    if (host === "youtu.be") id = parts[0];
    else if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1];
    if (!id || !YT_ID.test(id)) {
      return { error: "That YouTube link does not point to one video. Open the video, press Share and copy that link." };
    }
    const start = seconds(u.searchParams.get("t") ?? u.searchParams.get("start"));
    return { source: "youtube", ref: id, url: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`, start };
  }

  // Google Drive
  if (host === "drive.google.com" || host === "docs.google.com") {
    let id: string | null | undefined;
    const d = parts.indexOf("d");
    if (parts[0] === "file" && d > 0) id = parts[d + 1];
    else if (parts[0] === "open" || parts[0] === "uc") id = u.searchParams.get("id");
    if (parts.includes("folders")) {
      return { error: "That is a Google Drive folder. Open the video itself, press Share, and copy its link." };
    }
    if (!id || !DRIVE_ID.test(id)) {
      return { error: "That Google Drive link does not point to a video file. Open the video, press Share, and copy its link." };
    }
    return { source: "drive", ref: id, url: `https://drive.google.com/file/d/${id}/view` };
  }

  // Vimeo
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const at = parts.findIndex((p) => VIMEO_ID.test(p));
    const id = at >= 0 ? parts[at] : "";
    if (!id) return { error: "That Vimeo link does not point to one video. Open the video and copy its link." };
    const next = parts[at + 1];
    const hash = u.searchParams.get("h") ?? (next && VIMEO_HASH.test(next) ? next : "");
    const h = hash && VIMEO_HASH.test(hash) ? hash.toLowerCase() : "";
    return { source: "vimeo", ref: h ? `${id}:${h}` : id, url: `https://vimeo.com/${id}${h ? `/${h}` : ""}` };
  }

  // OneDrive / SharePoint / Microsoft Stream: only their embed address plays inside another site
  const isSharePoint = /^[a-z0-9-]+\.sharepoint\.com$/.test(host);
  const isOneDrive = host === "onedrive.live.com" || host === "1drv.ms" || host === "onedrive.com";
  if (isSharePoint || isOneDrive) {
    const embed =
      (isSharePoint && /\/_layouts\/15\/embed\.aspx$/i.test(u.pathname)) ||
      (host === "onedrive.live.com" && /^\/embed\/?$/i.test(u.pathname));
    if (!embed) {
      return {
        error:
          "OneDrive and SharePoint share links do not play inside another site. Open the video, choose Share › Embed code (in Stream) or ⋯ › Embed (in OneDrive), copy the code and paste it here.",
      };
    }
    u.protocol = "https:";
    u.hash = "";
    return { source: "microsoft", ref: u.toString(), url: u.toString() };
  }

  // A direct link to a video file
  if (/\.(mp4|m4v|webm|mov)$/i.test(u.pathname)) {
    if (u.protocol !== "https:") return { error: "Use the https:// link to the video file." };
    u.hash = "";
    return { source: "direct", ref: u.toString(), url: u.toString() };
  }

  return { error: LINK_HELP };
}

/** The address that plays a linked video inside the page. */
export function embedSrc(clip: Pick<LinkClip, "source" | "ref" | "start">): string {
  switch (clip.source) {
    case "youtube":
      return YT_ID.test(clip.ref)
        ? `https://www.youtube-nocookie.com/embed/${clip.ref}?rel=0&modestbranding=1&playsinline=1${clip.start ? `&start=${Math.floor(clip.start)}` : ""}`
        : "";
    case "drive":
      return DRIVE_ID.test(clip.ref) ? `https://drive.google.com/file/d/${clip.ref}/preview` : "";
    case "vimeo": {
      const [id, h] = clip.ref.split(":");
      if (!VIMEO_ID.test(id)) return "";
      return `https://player.vimeo.com/video/${id}?${h && VIMEO_HASH.test(h) ? `h=${h}&` : ""}dnt=1`;
    }
    case "microsoft":
    case "direct":
      return /^https:\/\//.test(clip.ref) ? clip.ref : "";
    default:
      return "";
  }
}

/** A still from the video to show before it loads, where the service offers one. */
export const posterFor = (clip: Pick<LinkClip, "source" | "ref">) =>
  clip.source === "youtube" && YT_ID.test(clip.ref) ? `https://i.ytimg.com/vi/${clip.ref}/hqdefault.jpg` : "";

/** Whether the video plays in the browser's own player (a file) or in the service's player (a frame). */
export const playsInFrame = (clip: { kind: string; source?: LinkSource }) =>
  clip.kind === "link" && clip.source !== "direct";
