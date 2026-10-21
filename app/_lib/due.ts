/**
 * Deadlines: shared by server pages, the calendar file route and the
 * teacher's calendar picker. All dates are shown and chosen in Riyadh time
 * (GMT+3, no daylight saving), and stored as exact instants.
 */

export const TZ = "Asia/Riyadh";
export const TZ_LABEL = "Riyadh time (GMT+3)";
const OFFSET_MS = 3 * 3600 * 1000;

export type Deadline = { section_id: string; lesson_id: string; due_at: string; note: string | null };

/** Deadlines of some classes. `missing` is true until DEADLINES-2026-10.sql has been run. */
export async function loadDeadlines(supabase: any, sectionIds: string[]): Promise<{ rows: Deadline[]; missing: boolean }> {
  if (!sectionIds.length) return { rows: [], missing: false };
  const { data, error } = await supabase
    .from("deadlines")
    .select("section_id, lesson_id, due_at, note")
    .in("section_id", sectionIds);
  if (error) return { rows: [], missing: /deadlines|relation|schema cache|does not exist/i.test(error.message ?? "") };
  return { rows: (data ?? []) as Deadline[], missing: false };
}

/** A student's deadline for each activity, from the classes they are in (the earliest if two classes differ). */
export async function studentDue(supabase: any, studentId: string) {
  const { data: enr } = await supabase
    .from("enrolments")
    .select("section_id")
    .eq("student_id", studentId)
    .eq("status", "active");
  const ids = ((enr ?? []) as any[]).map((e) => e.section_id);
  const { rows, missing } = await loadDeadlines(supabase, ids);
  const due: Record<string, string> = {};
  const note: Record<string, string | null> = {};
  for (const r of rows) {
    if (!due[r.lesson_id] || r.due_at < due[r.lesson_id]) {
      due[r.lesson_id] = r.due_at;
      note[r.lesson_id] = r.note;
    }
  }
  return { due, note, sectionIds: ids, missing };
}

/** Riyadh wall-clock parts of an instant (month is 0-based, dow 0 = Sunday). */
export function riyadhParts(d: Date) {
  const t = new Date(d.getTime() + OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), dow: t.getUTCDay() };
}

/** The instant of a Riyadh wall-clock time. */
export const fromRiyadh = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(Date.UTC(y, m, d, h, min) - OFFSET_MS);

const FMT_FULL = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
});
const FMT_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const FMT_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });

/** "Thu 30 Oct 2026, 11:59 pm" */
export const fmtDue = (iso: string) => FMT_FULL.format(new Date(iso)).replace(" at ", ", ").replace(/^(\w{3}),/, "$1");
/** "Thu 30 Oct" */
export const fmtDueDay = (iso: string) => FMT_DAY.format(new Date(iso)).replace(/^(\w{3}),/, "$1");
/** "11:59 pm" */
export const fmtDueTime = (iso: string) => FMT_TIME.format(new Date(iso));

/** "in 5 days", "in 3 hours", "2 days ago" */
export function relDue(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  const abs = Math.abs(ms);
  const mins = Math.ceil(abs / 60000);
  const hours = Math.floor(abs / 3600000);
  const days = Math.floor(abs / 86400000);
  const text =
    mins < 60 ? `${Math.max(1, mins)} min` : hours < 48 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"}`;
  return ms >= 0 ? `in ${text}` : `${text} ago`;
}

/** upcoming, soon (within two days) or past */
export function dueState(iso: string, now = Date.now()): "upcoming" | "soon" | "past" {
  const ms = new Date(iso).getTime() - now;
  return ms < 0 ? "past" : ms < 2 * 86400000 ? "soon" : "upcoming";
}

// ---- calendar files (.ics, RFC 5545) ------------------------------------

export type CalEvent = { uid: string; due: Date; title: string; description: string; url?: string };

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Lines longer than 75 bytes are folded, as the standard requires. */
function fold(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/**
 * A calendar file with one event per deadline. Each event sits at the
 * deadline itself (15 minutes long, so every calendar shows it) and carries
 * two reminders: a day before and an hour before.
 */
export function buildIcs(events: CalEvent[], calName: string) {
  const stamp = icsTime(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Foundations of Academic Presentations//Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(calName)}`,
    `X-WR-TIMEZONE:${TZ}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsTime(e.due)}`,
      `DTEND:${icsTime(new Date(e.due.getTime() + 15 * 60000))}`,
      `SUMMARY:${icsText(e.title)}`,
      `DESCRIPTION:${icsText(e.description)}`,
      ...(e.url ? [`URL:${e.url}`] : []),
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(e.title)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(e.title)}`,
      "TRIGGER:-PT1H",
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
