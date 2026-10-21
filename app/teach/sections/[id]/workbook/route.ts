import { NextResponse } from "next/server";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { mmss } from "@/app/_lib/format";
import { feedbackTotal, courseGrade, ACTIVITY_POINTS } from "@/app/_lib/scores";
import { buildXlsx, type Cell } from "@/app/_lib/xlsx";

export const dynamic = "force-dynamic";

/** A timestamp as a calendar date in Saudi time, so a late-evening attempt is not dated the next day. */
const TZ = "Asia/Riyadh";
const localDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The class progress workbook (.xlsx): the gradebook as an Excel file, built
 * fresh from the live data every time it is downloaded. Same access as the
 * gradebook page — staff only, and the database policies decide which
 * classes a teacher can read.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role === "student") return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const supabase = serverClient();
  const { data: section } = await supabase
    .from("sections")
    .select("id, number, term, course_id, courses(title), teacher:profiles!sections_teacher_id_fkey(full_name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!section) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  const sec = section as any;

  const [{ data: enrolled }, { data: tasks }, { data: subs }, { data: marks }] = await Promise.all([
    supabase
      .from("enrolments")
      .select("student_id, joined_at, status, student:profiles!enrolments_student_id_fkey(id, full_name, email)")
      .eq("section_id", sec.id)
      .eq("status", "active"),
    supabase
      .from("lessons")
      .select("id, title, unit, order_no, target_seconds")
      .eq("course_id", sec.course_id)
      .eq("kind", "practice")
      .order("unit")
      .order("order_no"),
    supabase
      .from("submissions")
      .select("id, student_id, lesson_id, attempt_no, duration_seconds, created_at, feedback(source, scores)")
      .eq("section_id", sec.id),
    supabase.from("current_grades").select("submission_id, student_id, lesson_id, total, comment, created_at").eq("section_id", sec.id),
  ]);

  const students = ((enrolled ?? []) as any[])
    .filter((e) => e.student)
    .map((e) => ({ ...e.student, joined_at: e.joined_at }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const taskList = (tasks ?? []) as any[];
  const allSubs = (subs ?? []) as any[];
  const allMarks = (marks ?? []) as any[];
  const markOf = (subId: string) => allMarks.find((m) => m.submission_id === subId) ?? null;
  const taskName = (t: any) => (t.unit != null ? `U${t.unit} · ${t.title}` : t.title);
  const units = Array.from(new Set(taskList.map((t) => t.unit))).sort((a, b) => a - b);
  const gradeOf = (studentId: string) => courseGrade(studentId, taskList, allSubs, allMarks);

  // 1. Summary — one row per student, as on the gradebook page
  const summary: Cell[][] = students.map((st) => {
    const mine = allSubs.filter((s) => s.student_id === st.id);
    const myMarks = allMarks.filter((m) => m.student_id === st.id);
    const mean = myMarks.length ? round1(myMarks.reduce((a, m) => a + Number(m.total), 0) / myMarks.length) : null;
    const last = mine.map((s) => s.created_at).sort().pop() ?? null;
    const unmarked = mine.filter((s) => !markOf(s.id)).length;
    const g = gradeOf(st.id);
    return [
      st.full_name,
      st.email,
      localDate(st.joined_at),
      mine.length,
      new Set(mine.map((s) => s.lesson_id)).size,
      taskList.length,
      myMarks.length,
      unmarked,
      mean,
      `${g.done}/${g.of}`,
      `${g.marked}/${g.of}`,
      g.total,
      localDate(last),
    ];
  });

  // 2. Points by activity — 10 points per activity (official mark /20, halved),
  // then each unit's subtotal and the course total out of 100
  const byTask: Cell[][] = students.map((st) => {
    const g = gradeOf(st.id);
    const cells: Cell[] = [st.full_name, st.email];
    g.activities.forEach((a) => cells.push(a.state === "marked" ? a.points : a.state === "recorded" ? "to mark" : ""));
    g.units.forEach((u) => cells.push(u.points));
    cells.push(g.total);
    return cells;
  });

  // 3. All attempts — one row per recording
  const order = new Map(taskList.map((t, i) => [t.id, i]));
  const nameOf = new Map(students.map((s) => [s.id, s]));
  const attempts: Cell[][] = allSubs
    .filter((s) => nameOf.has(s.student_id))
    .sort(
      (a, b) =>
        nameOf.get(a.student_id).full_name.localeCompare(nameOf.get(b.student_id).full_name) ||
        (order.get(a.lesson_id) ?? 99) - (order.get(b.lesson_id) ?? 99) ||
        a.attempt_no - b.attempt_no
    )
    .map((s) => {
      const st = nameOf.get(s.student_id);
      const t = taskList.find((x) => x.id === s.lesson_id);
      const m = markOf(s.id);
      const fb = (s.feedback ?? []) as any[];
      return [
        st.full_name,
        st.email,
        t?.unit ?? null,
        t?.title ?? "",
        s.attempt_no,
        localDate(s.created_at),
        s.duration_seconds != null ? mmss(s.duration_seconds) : "",
        t?.target_seconds != null ? mmss(t.target_seconds) : "",
        m ? Number(m.total) : null,
        m ? round1((Math.max(0, Math.min(20, Number(m.total))) / 20) * ACTIVITY_POINTS) : null,
        m ? localDate(m.created_at) : null,
        m?.comment ?? "",
        fb.filter((f) => f.source === "peer").length,
        feedbackTotal(fb),
      ];
    });

  const about: Cell[][] = [
    ["Course", sec.courses?.title ?? ""],
    ["Section", String(sec.number ?? "")],
    ["Term", sec.term ?? ""],
    ["Teacher", sec.teacher?.full_name ?? ""],
    ["Students", students.length],
    ["Practice tasks", taskList.length],
    ["Downloaded on", localDate(new Date().toISOString())],
    ["Downloaded by", profile.full_name],
    ["Grading", `Each of the ${taskList.length} activities is worth ${ACTIVITY_POINTS} points: its official mark out of 20, halved (16/20 = 8 points). Unit columns are subtotals. The activities add up to the total out of 100.`],
    ["Not yet marked", "An activity without an official mark counts as 0, so the total builds up over the term and is final once every activity is marked."],
    ["Note", "This file is a copy made when downloaded: the academy gradebook stays the official record."],
  ];

  const bytes = buildXlsx([
    {
      name: "Summary",
      header: ["Student", "Email", "Joined", "Attempts", "Tasks recorded", "Tasks in course", "Marked attempts", "Waiting for a mark", "Mean mark /20", "Activities done", "Activities marked", "Total /100", "Latest attempt"],
      rows: summary,
    },
    {
      name: "Points by activity",
      header: [
        "Student",
        "Email",
        ...taskList.map((t) => `${taskName(t)} /${ACTIVITY_POINTS}`),
        ...units.map((u) => `Unit ${u} /${taskList.filter((t) => t.unit === u).length * ACTIVITY_POINTS}`),
        "Total /100",
      ],
      rows: byTask,
      widths: [24, 30, ...taskList.map(() => 16), ...units.map(() => 10), 11],
    },
    {
      name: "All attempts",
      header: ["Student", "Email", "Unit", "Task", "Attempt", "Recorded on", "Length", "Target", "Official mark /20", "Points /10", "Marked on", "Teacher comment", "Classmate feedback", "Feedback average /20"],
      rows: attempts,
      widths: [24, 30, 6, 30, 8, 13, 8, 8, 10, 9, 13, 50, 10, 10],
    },
    { name: "About", header: ["Item", "Value"], rows: about, widths: [16, 70] },
  ]);

  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const safe = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, " ");
  const filename = `${safe(sec.courses?.title ?? "Class")} - Section ${safe(String(sec.number ?? ""))} - progress ${stamp}.xlsx`;

  return new NextResponse(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
