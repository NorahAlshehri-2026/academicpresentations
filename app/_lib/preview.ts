import "server-only";
import { cookies } from "next/headers";
import type { Profile } from "./types";
import { PREVIEW_COOKIE } from "./preview-cookie";

export { PREVIEW_COOKIE };

/**
 * Student preview: a teacher or administrator sees the whole site the way a
 * student does: the student tabs, the student Home page (with sample
 * details), and none of the staff-only parts (Recorded lectures, the answer
 * key, the admin links). It is a view switch kept in a cookie and nothing
 * more. It never changes who you are: the database still sees a teacher or
 * an administrator, and a student cannot use it to see anything.
 *
 * Turn it on or off with /preview?to=on|off&next=/somewhere. Opening a
 * staff-only page (My classes, Recorded lectures, Admin) turns it off.
 */
export function cookieSaysPreview(): boolean {
  try {
    return cookies().get(PREVIEW_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}

/** True when this signed-in teacher or administrator is in student preview. */
export function isPreviewing(profile: Pick<Profile, "role"> | null | undefined): boolean {
  return !!profile && profile.role !== "student" && cookieSaysPreview();
}

/** Whether a page should show itself as a student would see it. */
export function seesAsStudent(profile: Pick<Profile, "role"> | null | undefined): boolean {
  return !!profile && (profile.role === "student" || isPreviewing(profile));
}
