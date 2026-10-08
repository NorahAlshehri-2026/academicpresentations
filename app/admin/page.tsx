import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient, homeFor } from "@/app/_lib/supabase";
import StaffInvites from "@/app/_components/StaffInvites";
import { fmtDate } from "@/app/_lib/format";

const ROLE_ORDER: Record<string, number> = { admin: 0, teacher: 1, student: 2 };
const ROLE_LABEL: Record<string, string> = { admin: "Administrator", teacher: "Teacher", student: "Student" };

export default async function AdminDashboard() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "admin") redirect(homeFor(profile.role));

  const supabase = serverClient();

  const [{ data: isOwner }, { data: owner }, { data: people }, { data: sections }, { data: pending }] = await Promise.all([
    supabase.rpc("is_owner"),
    supabase.from("academy_owner").select("profile_id").maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, role, active, created_at"),
    supabase
      .from("sections")
      .select("id, number, term, courses(title), teacher:profiles!sections_teacher_id_fkey(full_name), enrolments(student_id, status)")
      .order("created_at"),
    supabase
      .from("staff_invites")
      .select("token, role, note, created_at")
      .is("used_by", null)
      .eq("revoked", false)
      .order("created_at", { ascending: false }),
  ]);

  const list = ((people ?? []) as any[]).sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.full_name.localeCompare(b.full_name)
  );
  const count = (role: string) => list.filter((p) => p.role === role).length;
  const ownerName = list.find((p) => p.id === (owner as any)?.profile_id)?.full_name ?? "the academy owner";

  return (
    <>
      <div className="card">
        <h3>The academy</h3>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="pill">{count("student")} students</span>
          <span className="pill">{count("teacher")} teachers</span>
          <span className="pill">{count("admin")} admins</span>
          <span className="pill">{sections?.length ?? 0} classes</span>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Students join with a class link, which every teacher shares from <b>My classes</b>. Teachers and
          administrators join with a one-time link that only {isOwner ? "you" : ownerName} can make.
        </p>
      </div>

      {isOwner ? (
        <StaffInvites pending={(pending ?? []) as any[]} />
      ) : (
        <div className="card">
          <h3>Invitations</h3>
          <p className="small muted">Only {ownerName} can invite teachers and administrators.</p>
        </div>
      )}

      <div className="card">
        <h3>All classes</h3>
        {sections?.length ? (
          <div className="tablewrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr><th>Class</th><th>Teacher</th><th>Students</th><th>Term</th></tr>
              </thead>
              <tbody>
                {(sections as any[]).map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/teach/sections/${s.id}`}>{s.courses?.title} · {s.number}</Link></td>
                    <td>{s.teacher?.full_name ?? "—"}</td>
                    <td>{(s.enrolments ?? []).filter((e: any) => e.status === "active").length}</td>
                    <td>{s.term}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small muted">No classes yet. Teachers open them under My classes.</p>
        )}
      </div>

      <div className="card">
        <h3>People</h3>
        <div className="tablewrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th></tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name}{p.id === (owner as any)?.profile_id ? " · owner" : ""}</td>
                  <td>{p.email}</td>
                  <td>{ROLE_LABEL[p.role]}</td>
                  <td>{fmtDate(p.created_at)}</td>
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
