/**
 * Announcements, shared by the server, the API route and the components.
 * See app/_lib/announcements.ts for where they are kept and who sees them.
 */

export const TITLE_MAX = 120;
export const BODY_MAX = 2000;
/** The newest this many are kept; older ones that have ended are dropped first. */
export const KEEP_MAX = 300;
/** A post counts as new on a student's Home page for this long. */
export const NEW_FOR_MS = 3 * 24 * 3600 * 1000;

/** How long an announcement shows to students. 0 = until it is removed. */
export const SHOW_FOR = [
  { days: 0, label: "Until I remove it" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
] as const;

export type Announcement = {
  id: string;
  title: string;
  body: string;
  /** "all" = every student in the academy (administrators only); "sections" = the classes listed */
  audience: "all" | "sections";
  sections: string[];
  by: string;
  byId: string;
  byRole: "teacher" | "admin";
  posted: string;
  edited?: string;
  /** after this instant students no longer see it; null = until removed */
  until: string | null;
};

/** What a page needs to show one: the class names already worked out. */
export type AnnouncementShown = Announcement & {
  /** e.g. "Section 101" or "Sections 101, 102" or "Everyone" */
  to: string;
  ended: boolean;
  isNew: boolean;
  canEdit: boolean;
};

/** A class a teacher or administrator may post to. */
export type SectionChoice = { id: string; label: string; course: string; term: string };

export const isAnnouncementId = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]{8,32}$/.test(v);

export const newAnnouncementId = () =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 20);

/** End of the day (Riyadh, 11:59 pm) a number of days from now. */
export function untilFromDays(days: number, now = Date.now()): string | null {
  if (!days) return null;
  const OFFSET = 3 * 3600 * 1000;
  const t = new Date(now + OFFSET + days * 86400000);
  const end = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 23, 59) - OFFSET;
  return new Date(end).toISOString();
}

/** Splits text into plain parts and web links, so links in a message can be tapped. */
export function linkParts(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = [];
  const re = /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], href: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
