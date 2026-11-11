import { NextResponse } from "next/server";
import { currentProfile, type Profile } from "@/app/_lib/supabase";
import { canChange, loadAnnouncements, postableSections, saveAnnouncements } from "@/app/_lib/announcements";
import {
  BODY_MAX,
  SHOW_FOR,
  TITLE_MAX,
  isAnnouncementId,
  newAnnouncementId,
  untilFromDays,
  type Announcement,
} from "@/app/_lib/announcement-types";

export const dynamic = "force-dynamic";

/**
 * Announcements, for teachers and administrators (students are refused).
 *   POST   { title, body, audience: "all" | "sections", sections: [id], days }  → posts a new one
 *   PATCH  { id, title, body, audience, sections, days? }                        → changes one (days left out = same end)
 *   DELETE { id }                                                                → removes one
 * A teacher posts only to classes they teach and changes only their own posts.
 * An administrator may post to any class or to everyone, and change any post.
 */
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const UNREADABLE = "The announcements could not be read just now. Please try again.";
const GONE = "That announcement is no longer there. Reload the page.";
const NOT_YOURS = "Only the teacher who posted this announcement, or an administrator, can change it.";

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "";

async function staff() {
  const profile = await currentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "teacher")) return null;
  return profile;
}

/** Checks who the post goes to. Returns the audience, or an error message. */
async function audienceOf(profile: Profile, body: any): Promise<{ audience: "all" | "sections"; sections: string[] } | string> {
  if (body?.audience === "all") {
    if (profile.role !== "admin") return "Only administrators can post to everyone in the academy.";
    return { audience: "all", sections: [] };
  }
  const asked: string[] = Array.isArray(body?.sections) ? body.sections.filter((s: unknown) => typeof s === "string") : [];
  const wanted = Array.from(new Set(asked));
  if (!wanted.length) return "Choose at least one class.";
  const allowed = new Set((await postableSections(profile)).map((s) => s.id));
  if (wanted.some((id) => !allowed.has(id))) {
    return profile.role === "admin" ? "One of those classes no longer exists. Reload the page." : "You can post only to classes you teach.";
  }
  return { audience: "sections", sections: wanted };
}

function daysOf(v: unknown): number | null {
  const n = Number(v);
  return SHOW_FOR.some((o) => o.days === n) ? n : null;
}

async function load() {
  try {
    return await loadAnnouncements(true);
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function save(items: Announcement[]) {
  const { error } = await saveAnnouncements(items);
  if (error) {
    console.error("announcements: save", error);
    return fail("The announcement could not be saved. Please try again.", 500);
  }
  return null;
}

export async function POST(request: Request) {
  const profile = await staff();
  if (!profile) return fail("Only teachers and administrators can post announcements.", 403);
  const body = await request.json().catch(() => null);

  const title = clean(body?.title, TITLE_MAX);
  const text = clean(body?.body, BODY_MAX);
  if (!title) return fail("Give the announcement a title.");
  if (!text) return fail("Write the message.");
  const days = daysOf(body?.days ?? 0);
  if (days === null) return fail("Choose how long it shows.");
  const who = await audienceOf(profile, body);
  if (typeof who === "string") return fail(who);

  const items = await load();
  if (!items) return fail(UNREADABLE, 500);

  const item: Announcement = {
    id: newAnnouncementId(),
    title,
    body: text,
    ...who,
    by: profile.full_name,
    byId: profile.id,
    byRole: profile.role === "admin" ? "admin" : "teacher",
    posted: new Date().toISOString(),
    until: untilFromDays(days),
  };
  const err = await save([item, ...items]);
  if (err) return err;
  return NextResponse.json({ ok: true, id: item.id });
}

export async function PATCH(request: Request) {
  const profile = await staff();
  if (!profile) return fail("Only teachers and administrators can change announcements.", 403);
  const body = await request.json().catch(() => null);
  if (!isAnnouncementId(body?.id)) return fail(GONE, 404);

  const title = clean(body?.title, TITLE_MAX);
  const text = clean(body?.body, BODY_MAX);
  if (!title) return fail("Give the announcement a title.");
  if (!text) return fail("Write the message.");
  const keepEnd = body?.days === undefined || body?.days === null || body?.days === "same";
  const days = keepEnd ? null : daysOf(body.days);
  if (!keepEnd && days === null) return fail("Choose how long it shows.");

  const items = await load();
  if (!items) return fail(UNREADABLE, 500);
  const current = items.find((a) => a.id === body.id);
  if (!current) return fail(GONE, 404);
  if (!canChange(profile, current)) return fail(NOT_YOURS, 403);

  // an administrator editing a teacher's post may also widen it; a teacher keeps to their own classes
  const who = await audienceOf(profile, body);
  if (typeof who === "string") return fail(who);

  const next: Announcement = {
    ...current,
    title,
    body: text,
    ...who,
    edited: new Date().toISOString(),
    until: keepEnd ? current.until : untilFromDays(days ?? 0),
  };
  const err = await save(items.map((a) => (a.id === current.id ? next : a)));
  if (err) return err;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const profile = await staff();
  if (!profile) return fail("Only teachers and administrators can remove announcements.", 403);
  const body = await request.json().catch(() => null);
  if (!isAnnouncementId(body?.id)) return fail(GONE, 404);

  const items = await load();
  if (!items) return fail(UNREADABLE, 500);
  const current = items.find((a) => a.id === body.id);
  if (!current) return NextResponse.json({ ok: true }); // already gone
  if (!canChange(profile, current)) return fail(NOT_YOURS, 403);

  const err = await save(items.filter((a) => a.id !== current.id));
  if (err) return err;
  return NextResponse.json({ ok: true });
}
