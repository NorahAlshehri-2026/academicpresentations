/**
 * The student preview cookie, shared by the server pages, the /preview route
 * and the middleware (which cannot import server-only modules).
 */
export const PREVIEW_COOKIE = "ap_student_preview";

/** A preview lasts a working day at most, then the site shows the staff view again. */
export const PREVIEW_MAX_AGE = 8 * 60 * 60;

/** Staff-only pages. Opening one of them ends the student preview. */
export const STAFF_ONLY_PATHS = ["/teach", "/admin", "/videos", "/dashboard"];

export const isStaffOnlyPath = (path: string) =>
  STAFF_ONLY_PATHS.some((p) => path === p || path.startsWith(p + "/"));

/**
 * Where the preview should open from the page you are on: the same page when
 * students have it too, otherwise the student Home page.
 */
export function previewTarget(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (isStaffOnlyPath(path) || path.startsWith("/review/") || path.startsWith("/preview")) return "/";
  return path;
}

/** A safe place to send someone after switching: a path on this site only. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export const startPreviewHref = (path: string) => `/preview?to=on&next=${encodeURIComponent(previewTarget(path))}`;
export const stopPreviewHref = (next = "/") => `/preview?to=off&next=${encodeURIComponent(next)}`;
