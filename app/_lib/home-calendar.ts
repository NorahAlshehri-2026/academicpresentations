import "server-only";
import type { CalItem } from "@/app/_components/HomeCalendar";
import { loadDeadlines, type Deadline } from "./due";
import type { Profile } from "./types";

/**
 * The deadlines for the Home page calendar.
 *   student            the classes they are in (one deadline per activity, the
 *                      earliest if two classes differ), ticked once recorded
 *   teacher / admin    the classes they teach (administrators: every class);
 *                      the same activity due at the same time in several
 *                      classes is one entry, "Sections 101, 102"
 *   student preview    what the viewer's own students see, without ticks
 * Everything is read with the person's own sign-in, so the database rules
 * decide which deadlines they can see.
 */

type Lesson = { id: string; title: string; unit: number; course_id: string };

async function lessonsOf(supabase: any, rows: Deadline[]): Promise<Map<string, Lesson>> {
  const ids = Array.from(new Set(rows.map((r) => r.lesson_id)));
  if (!ids.length) return new Map();
  const { data } = await supabase.from("lessons").select("id, title, unit, course_id").in("id", ids);
  return new Map(((data ?? []) as Lesson[]).map((l) => [l.id, l]));
}

/** One deadline per activity: the earliest. */
function earliest(rows: Deadline[]): Deadline[] {
  const best = new Map<string, Deadline>();
  for (const r of rows) {
    const cur = best.get(r.lesson_id);
    if (!cur || r.due_at < cur.due_at) best.set(r.lesson_id, r);
  }
  return Array.from(best.values());
}

async function enrolledSections(supabase: any, studentId: string): Promise<string[]> {
  const { data } = await supabase
    .from("enrolments")
    .select("section_id")
    .eq("student_id", studentId)
    .eq("status", "active");
  return ((data ?? []) as any[]).map((e) => e.section_id);
}

async function taughtSections(supabase: any, profile: Profile, everyClassForAdmin: boolean) {
  let q = supabase.from("sections").select("id, number").order("number");
  if (!(everyClassForAdmin && profile.role === "admin")) q = q.eq("teacher_id", profile.id);
  const { data } = await q;
  return (data ?? []) as { id: string; number: string | number }[];
}

/** A student's calendar. `recorded` = the activities they have saved an attempt for. */
export async function studentCalendar(supabase: any, profile: Profile, recorded: Set<string>) {
  const ids = await enrolledSections(supabase, profile.id);
  const { rows } = await loadDeadlines(supabase, ids);
  const list = earliest(rows);
  const lessons = await lessonsOf(supabase, list);
  return list
    .map((r): CalItem | null => {
      const l = lessons.get(r.lesson_id);
      if (!l) return null;
      return {
        key: r.lesson_id,
        title: l.title,
        dueAt: r.due_at,
        href: `/learn/${l.course_id}/${l.id}`,
        unit: l.unit,
        done: recorded.has(l.id),
        note: r.note,
      };
    })
    .filter(Boolean) as CalItem[];
}

/** A teacher's or administrator's calendar of their classes' deadlines. */
export async function staffCalendar(supabase: any, profile: Profile) {
  const sections = await taughtSections(supabase, profile, true);
  const { rows } = await loadDeadlines(supabase, sections.map((s) => s.id));
  const lessons = await lessonsOf(supabase, rows);
  const num = new Map(sections.map((s) => [s.id, String(s.number)]));

  // the same activity due at the same moment in several classes is one entry
  const groups = new Map<string, Deadline[]>();
  for (const r of rows) {
    const k = `${r.lesson_id}|${r.due_at}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return Array.from(groups.entries())
    .map(([k, list]): CalItem | null => {
      const l = lessons.get(list[0].lesson_id);
      if (!l) return null;
      const nums = list
        .map((r) => num.get(r.section_id) ?? "")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
      return {
        key: k,
        title: l.title,
        dueAt: list[0].due_at,
        href: `/teach/sections/${list[0].section_id}`,
        unit: l.unit,
        where: nums.length ? `Section${nums.length === 1 ? "" : "s"} ${nums.join(", ")}` : undefined,
        note: list.length === 1 ? list[0].note : null,
      };
    })
    .filter(Boolean) as CalItem[];
}

/** The student preview: the deadlines the viewer's own students see. */
export async function previewCalendar(supabase: any, profile: Profile) {
  const sections = await taughtSections(supabase, profile, false);
  const { rows } = await loadDeadlines(supabase, sections.map((s) => s.id));
  const list = earliest(rows);
  const lessons = await lessonsOf(supabase, list);
  return list
    .map((r): CalItem | null => {
      const l = lessons.get(r.lesson_id);
      if (!l) return null;
      return { key: r.lesson_id, title: l.title, dueAt: r.due_at, href: `/learn/${l.course_id}/${l.id}`, unit: l.unit, note: r.note };
    })
    .filter(Boolean) as CalItem[];
}
