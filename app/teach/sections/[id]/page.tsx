import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentProfile, serverClient, homeFor } from "@/app/_lib/supabase";
import { RUBRIC } from "@/app/_lib/rubric";
import { criterionAverages, weakest, courseGrade } from "@/app/_lib/scores";
import { fmtDate } from "@/app/_lib/format";
import { Radar, RADAR_LABELS } from "@/app/_components/Charts";
import ClassLink from "@/app/_components/ClassLink";
import AddStudent from "@/app/_components/AddStudent";
import RemoveStudent from "@/app/_components/RemoveStudent";
import DeleteSection from "@/app/_components/DeleteSection";
import { ClassTracker, Legend } from "@/app/_components/ProgressTracker";

/** The gradebook for one class: who has joined, what they have done, their marks. */
export default async function Gradebook({ params }: { params: { id: string } }) {
  const profile = await currentProfile();
  if (!profile) redirect(`/login?next=/teach/sections/${params.id}`);
  if (profile.role === "student") redirect(homeFor(profile.role));

  const supabase = serverClient();

  const { data: section } = await supabase
    .from("sections")
    .select("id, number, term, invite_code, invites_open, teacher_id, course_id, courses(id, title), teacher:profiles!sections_teacher_id_fkey(full_name)")
    .eq("id", params.id)
    .maybeSingle();

  if (!section) notFound();
  const sec = section as any;
  const own = sec.teacher_id === profile.id;
  const isAdmin = profile.role === "admin";

  const [{ data: enrolled }, { data: tasks }, { data: subs }, { data: marks }] = await Promise.all([
    supabase
      .from("enrolments")
      .select("student_id, joined_at, status, student:profiles!enrolments_student_id_fkey(id, full_name, email)")
      .eq("section_id", sec.id)
      .eq("status", "active"),
    supabase
      .from("lessons")
      .select("id, title, unit, order_no")
      .eq("course_id", sec.course_id)
      .eq("kind", "practice")
      .order("unit")
      .order("order_no"),
    supabase
      .from("submissions")
      .select("id, student_id, lesson_id, attempt_no, created_at, feedback(scores)")
      .eq("section_id", sec.id),
    supabase.from("current_grades").select("submission_id, student_id, lesson_id, total").eq("section_id", sec.id),
  ]);

  const students = ((enrolled ?? []) as any[])
    .filter((e) => e.student)
    .map((e) => ({ ...e.student, joined_at: e.joined_at }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const allSubs = (subs ?? []) as any[];
  const allMarks = (marks ?? []) as any[];
  const taskList = (tasks ?? []) as any[];

  const rows = students.map((st) => {
    const mine = allSubs.filter((s) => s.student_id === st.id);
    const myMarks = allMarks.filter((m) => m.student_id === st.id);
    const mean = myMarks.length ? Math.round((myMarks.reduce((a, m) => a + m.total, 0) / myMarks.length) * 10) / 10 : null;
    const last = mine.map((s) => s.created_at).sort().pop() ?? null;
    const unmarked = mine.filter((s) => !allMarks.some((m) => m.submission_id === s.id)).length;
    const grade = courseGrade(st.id, taskList, allSubs, allMarks);
    return { st, mine, myMarks, mean, last, unmarked, grade, covered: new Set(mine.map((s) => s.lesson_id)).size };
  });

  const avg = criterionAverages(allSubs.flatMap((s) => s.feedback ?? []));
  const weak = weakest(avg);
  const toMark = rows.reduce((a, r) => a + r.unmarked, 0);

  return (
    <>
      <div className="card">
        <Link className="btn ghost sm" href={own ? "/teach" : "/admin"}>← {own ? "My classes" : "Academy"}</Link>
        <div className="spread" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 18 }}>{sec.courses?.title} · Section {sec.number}</h3>
          <span className="pill">{students.length} student{students.length === 1 ? "" : "s"}</span>
        </div>
        <div className="meta">{sec.term} · Teacher: {sec.teacher?.full_name ?? "—"}</div>
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <Link className="btn sm act" style={{ ["--act" as any]: "#1f7fa8" }} href={`/learn/${sec.course_id}`}>
            Student preview
          </Link>
          <a className="btn sm act" style={{ ["--act" as any]: "#1d7a45" }} href={`/teach/sections/${sec.id}/workbook`} download>
            ⬇ Download progress workbook (Excel)
          </a>
        </div>
        {toMark > 0 && (
          <div className="note" style={{ marginTop: 10 }}>
            <b>{toMark}</b> attempt{toMark === 1 ? "" : "s"} waiting for a mark. Open a student to listen and mark.
          </div>
        )}
        {own && (
          <ClassLink
            sectionId={sec.id}
            code={sec.invite_code}
            open={sec.invites_open}
            courseTitle={sec.courses?.title ?? "The course"}
            sectionNumber={sec.number}
            term={sec.term}
            teacherName={profile.full_name}
          />
        )}
        {(own || isAdmin) && (
          <AddStudent
            sectionId={sec.id}
            courseTitle={sec.courses?.title ?? "The course"}
            sectionNumber={String(sec.number)}
            term={sec.term}
            teacherName={sec.teacher?.full_name ?? profile.full_name}
          />
        )}
      </div>

      <div className="card">
        <h3>Students</h3>
        {students.length ? (
          <>
            <div className="tablewrap" style={{ marginTop: 10 }}>
              <table style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Student</th><th>Email</th><th>Joined</th><th>Attempts</th><th>Tasks</th>
                    <th>To mark</th><th>Mean /20</th><th title="10 points per activity; unmarked activities count as 0">Total /100</th><th>Last</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.st.id}>
                      <td>
                        <Link href={`/teach/sections/${sec.id}/students/${r.st.id}`}>{r.st.full_name}</Link>
                      </td>
                      <td>{r.st.email}</td>
                      <td>{fmtDate(r.st.joined_at)}</td>
                      <td>{r.mine.length}</td>
                      <td>{r.covered}/{taskList.length}</td>
                      <td>{r.unmarked || "—"}</td>
                      <td>{r.mean ?? "—"}</td>
                      <td><b>{r.grade.marked ? r.grade.total : "—"}</b></td>
                      <td>{fmtDate(r.last)}</td>
                      <td><RemoveStudent sectionId={sec.id} studentId={r.st.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Open a student to hear their attempts and mark them. Total /100: each of the ten activities is worth 10
              points (its mark out of 20, halved); an activity not yet marked counts as 0. Removing a student keeps their
              recordings and marks.
            </p>
          </>
        ) : (
          <p className="small muted">Nobody has joined yet. Share the class link or add students by email above.</p>
        )}
      </div>

      {students.length > 0 && (
        <div className="card">
          <div className="spread">
            <h3>Progress tracker</h3>
            <span className="pill">10 activities × 10 points = 100</span>
          </div>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            Each activity is worth 10 points, worked out from its official mark out of 20 (16/20 = 8 points). Click a
            coloured cell to listen and mark, or to change a mark. A dot means a newer attempt is waiting for a mark.
          </p>
          <Legend />
          <ClassTracker
            tasks={taskList}
            rows={rows.map((r) => ({
              id: r.st.id,
              name: r.st.full_name,
              href: `/teach/sections/${sec.id}/students/${r.st.id}`,
              grade: r.grade,
            }))}
            hrefFor={(a) => (a.latestId ? `/review/${a.latestId}` : null)}
          />
        </div>
      )}

      {allSubs.length > 0 && (
        <>
          <div className="card">
            <h3>Class profile</h3>
            <div style={{ marginTop: 10 }}>
              <Radar values={RUBRIC.map((c) => avg[c.id] ?? 0)} labels={RADAR_LABELS} />
            </div>
            {weak && (
              <div className="note" style={{ marginTop: 12 }}>
                <b>Teach this next:</b> {weak.name} is the weakest criterion across the class.
              </div>
            )}
          </div>
        </>
      )}

      {(own || isAdmin) && (
        <DeleteSection
          sectionId={sec.id}
          sectionNumber={String(sec.number)}
          students={students.length}
          attempts={allSubs.length}
          marks={allMarks.length}
          canDelete={isAdmin || allMarks.length === 0}
          after={own ? "/teach" : "/admin"}
        />
      )}
    </>
  );
}
