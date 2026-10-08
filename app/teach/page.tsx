import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient, homeFor } from "@/app/_lib/supabase";
import ClassLink from "@/app/_components/ClassLink";

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

  // who has actually joined each section, which is not the same as who has
  // been marked — a student can be enrolled with nothing submitted yet
  const { data: enrolled } = await supabase
    .from("enrolments")
    .select("section_id, student_id, profiles!inner(full_name, email)")
    .eq("status", "active");

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3>Teaching</h3>
          <Link className="btn gold" href="/teach/sections/new">Open a class</Link>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          {sections?.length
            ? `${sections.length} class${sections.length === 1 ? "" : "es"} running. Each one has its own link to share with its students.`
            : "No classes yet. Open one, then share its link with your students."}
        </p>
      </div>

      {courses?.length ? (
        <div className="card">
          <h3>My courses</h3>
          <div className="row" style={{ marginTop: 10 }}>
            {courses.map((c: any) => (
              <Link key={c.id} className="btn ghost" href={`/learn/${c.id}`}>
                {c.title} {c.published ? "" : "· draft"}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {sections?.map((s: any) => {
        const rows = totals?.filter((t: any) => t.section_id === s.id) ?? [];
        const members = enrolled?.filter((e: any) => e.section_id === s.id) ?? [];
        return (
          <div className="card" key={s.id}>
            <div className="spread">
              <h3>
                {s.courses?.title} · Section {s.number}
              </h3>
              <span className="tiny muted">{s.term}</span>
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <span className="pill">
                {members.length} joined
              </span>
              <span className="pill">{rows.length} marked</span>
              <Link
                className="btn ghost sm"
                href={`/teach/sections/new?course=${s.courses?.id ?? ""}&term=${encodeURIComponent(s.term)}`}
                style={{ marginLeft: "auto" }}
              >
                Duplicate for another section
              </Link>
              <Link className="btn ghost sm" href={`/teach/sections/${s.id}`}>
                Open gradebook
              </Link>
            </div>

            <ClassLink
              sectionId={s.id}
              code={s.invite_code}
              open={s.invites_open}
              courseTitle={s.courses?.title ?? "The course"}
              sectionNumber={s.number}
              term={s.term}
              teacherName={profile.full_name}
            />

            {members.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary className="small" style={{ cursor: "pointer", fontWeight: 600 }}>
                  Who has joined ({members.length})
                </summary>
                <div className="tablewrap" style={{ marginTop: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m: any) => (
                        <tr key={m.student_id}>
                          <td>{m.profiles?.full_name}</td>
                          <td>{m.profiles?.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

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
