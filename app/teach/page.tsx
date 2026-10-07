import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient, homeFor } from "@/app/_lib/supabase";

export default async function TeacherDashboard() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/teach");
  if (profile.role === "student") redirect(homeFor(profile.role));

  const supabase = serverClient();

  const { data: sections } = await supabase
    .from("sections")
    .select("id, number, term, invite_code, invites_open, courses(id, title)")
    .eq("teacher_id", profile.id);

  const { data: totals } = await supabase
    .from("section_totals")
    .select("section_id, student_id, student_name, marked_items, mean_out_of_20, last_marked");

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, published")
    .eq("owner_id", profile.id);

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3>Teaching</h3>
          <Link className="btn gold" href="/teach/courses/new">New course</Link>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          {sections?.length
            ? `${sections.length} section${sections.length === 1 ? "" : "s"} running.`
            : "No sections yet. Create a course, then open a section for your class."}
        </p>
      </div>

      {courses?.length ? (
        <div className="card">
          <h3>My courses</h3>
          <div className="row" style={{ marginTop: 10 }}>
            {courses.map((c: any) => (
              <Link key={c.id} className="btn ghost" href={`/teach/courses/${c.id}`}>
                {c.title} {c.published ? "" : "· draft"}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {sections?.map((s: any) => {
        const rows = totals?.filter((t: any) => t.section_id === s.id) ?? [];
        return (
          <div className="card" key={s.id}>
            <div className="spread">
              <h3>
                {s.courses?.title} · Section {s.number}
              </h3>
              <span className="tiny muted">{s.term}</span>
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <span className="pill">{rows.length} marked</span>
              {s.invites_open && <span className="tiny muted">join code {s.invite_code}</span>}
              <Link className="btn ghost" href={`/teach/sections/${s.id}`} style={{ marginLeft: "auto" }}>
                Open gradebook
              </Link>
            </div>

            {rows.length > 0 && (
              <div className="tablewrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Marked</th>
                      <th>Mean /20</th>
                      <th>Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t: any) => (
                      <tr key={t.student_id}>
                        <td>{t.student_name}</td>
                        <td>{t.marked_items}</td>
                        <td>{t.mean_out_of_20}</td>
                        <td>{t.last_marked ? new Date(t.last_marked).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
