import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentProfile, serverClient, homeFor } from "@/app/_lib/supabase";
import { RUBRIC } from "@/app/_lib/rubric";
import { criterionAverages, weakest } from "@/app/_lib/scores";
import { fmtDate } from "@/app/_lib/format";
import { Radar, RADAR_LABELS } from "@/app/_components/Charts";
import ClassLink from "@/app/_components/ClassLink";
import RemoveStudent from "@/app/_components/RemoveStudent";

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
    return { st, mine, myMarks, mean, last, unmarked, covered: new Set(mine.map((s) => s.lesson_id)).size };
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
        <Link className="btn ghost sm" href={`/learn/${sec.course_id}`} style={{ marginTop: 10 }}>
          Student preview
        </Link>
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
      </div>

      <div className="card">
        <h3>Students</h3>
        {students.length ? (
          <>
            <div className="tablewrap" style={{ marginTop: 10 }}>
              <table style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Student</th><th>Email</th><th>Joined</th><th>Attempts</th><th>Tasks</th>
                    <th>To mark</th><th>Mean /20</th><th>Last</th><th></th>
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
                      <td>{fmtDate(r.last)}</td>
                      <td><RemoveStudent sectionId={sec.id} studentId={r.st.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Open a student to hear their attempts and mark them. Removing a student keeps their recordings and marks.
            </p>
          </>
        ) : (
          <p className="small muted">Nobody has joined yet. Share the class link above.</p>
        )}
      </div>

      {allSubs.length > 0 && (
        <>
          <div className="card">
            <h3>Who has done what</h3>
            <p className="tiny muted">Attempts per task. A ✓ means the latest attempt has an official mark.</p>
            <div className="tablewrap" style={{ marginTop: 10 }}>
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Student</th>
                    {taskList.map((t) => <th key={t.id}>{t.title}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.st.id}>
                      <td><b>{r.st.full_name}</b></td>
                      {taskList.map((t) => {
                        const att = r.mine.filter((s) => s.lesson_id === t.id);
                        const latest = att.sort((a, b) => b.attempt_no - a.attempt_no)[0];
                        const marked = latest && allMarks.find((m) => m.submission_id === latest.id);
                        return (
                          <td key={t.id} style={{ textAlign: "center" }}>
                            {att.length ? `${att.length}/2${marked ? ` ✓ ${marked.total}` : ""}` : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
    </>
  );
}
