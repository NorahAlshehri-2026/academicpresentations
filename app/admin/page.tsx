import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient, homeFor } from "@/app/_lib/supabase";

export default async function AdminDashboard() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "admin") redirect(homeFor(profile.role));

  const supabase = serverClient();

  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active")
    .order("role")
    .order("full_name");

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, published, owner_id");

  const count = (role: string) => people?.filter((p: any) => p.role === role).length ?? 0;

  return (
    <>
      <div className="card">
        <h3>The academy</h3>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="pill">{count("student")} students</span>
          <span className="pill">{count("teacher")} teachers</span>
          <span className="pill">{count("admin")} admins</span>
          <span className="pill">{courses?.length ?? 0} courses</span>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <Link className="btn ghost" href="/teach">
            My classes and class links
          </Link>
          <Link className="btn ghost" href="/courses">
            The course
          </Link>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          To add students, open <b>My classes</b> and share that section&rsquo;s class link. An
          emailed invitation is only needed for a teacher or another administrator.
        </p>
      </div>

      <div className="card">
        <div className="spread">
          <h3>People</h3>
          <a className="btn gold" href="/admin/invite">Invite someone</a>
        </div>
        <div className="tablewrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {people?.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.full_name}</td>
                  <td>{p.email}</td>
                  <td>{p.role}</td>
                  <td>{p.active ? "active" : "disabled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
