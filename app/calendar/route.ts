import { NextResponse } from "next/server";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { buildIcs, fmtDue, loadDeadlines, type CalEvent } from "@/app/_lib/due";

export const dynamic = "force-dynamic";

/**
 * Deadlines as a calendar file (.ics) that opens in Apple Calendar, Google
 * Calendar, Outlook or any other calendar app.
 *
 *   /calendar?section=<id>               every deadline of one class
 *   /calendar?section=<id>&lesson=<id>   one deadline
 *   /calendar                            all deadlines of the classes I am in
 *
 * What a person can download is decided by the database policies: a class's
 * teacher, administrators and the class's own students.
 */
export async function GET(request: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const url = new URL(request.url);
  const sectionParam = url.searchParams.get("section");
  const lessonParam = url.searchParams.get("lesson");
  const supabase = serverClient();

  let sectionIds: string[];
  if (sectionParam) {
    sectionIds = [sectionParam];
  } else {
    const { data: enr } = await supabase
      .from("enrolments")
      .select("section_id")
      .eq("student_id", profile.id)
      .eq("status", "active");
    sectionIds = ((enr ?? []) as any[]).map((e) => e.section_id);
  }

  const { rows, missing } = await loadDeadlines(supabase, sectionIds);
  if (missing) return NextResponse.json({ error: "Deadlines are not switched on yet." }, { status: 503 });
  const wanted = rows.filter((r) => !lessonParam || r.lesson_id === lessonParam);

  const [{ data: sections }, { data: lessons }] = await Promise.all([
    sectionIds.length
      ? supabase.from("sections").select("id, number, course_id, courses(title)").in("id", sectionIds)
      : Promise.resolve({ data: [] as any[] }),
    wanted.length
      ? supabase.from("lessons").select("id, title, unit, course_id").in("id", Array.from(new Set(wanted.map((r) => r.lesson_id))))
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const origin = url.origin;
  const events: CalEvent[] = wanted
    .map((r) => {
      const sec = ((sections ?? []) as any[]).find((s) => s.id === r.section_id);
      const les = ((lessons ?? []) as any[]).find((l) => l.id === r.lesson_id);
      if (!les) return null;
      const course = sec?.courses?.title ?? "Academic Presentations";
      const link = `${origin}/learn/${les.course_id}/${les.id}`;
      return {
        uid: `${r.section_id}-${r.lesson_id}@academicpresentations`,
        due: new Date(r.due_at),
        title: `Due: ${les.title}`,
        description:
          `${course}${sec ? ` · Section ${sec.number}` : ""}\n` +
          `Unit ${les.unit} speaking activity: ${les.title}\n` +
          `Deadline: ${fmtDue(r.due_at)} (Riyadh time)\n` +
          (r.note ? `Note from your teacher: ${r.note}\n` : "") +
          `Open the activity: ${link}`,
        url: link,
      } as CalEvent;
    })
    .filter(Boolean) as CalEvent[];

  events.sort((a, b) => a.due.getTime() - b.due.getTime());

  const one = ((sections ?? []) as any[]).length === 1 ? (sections as any[])[0] : null;
  const calName = one
    ? `${one.courses?.title ?? "Academic Presentations"} · Section ${one.number} deadlines`
    : "Academic Presentations deadlines";
  const filename = (lessonParam && events[0] ? events[0].title.replace(/^Due: /, "Deadline - ") : calName)
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, " ");

  return new NextResponse(buildIcs(events, calName), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
