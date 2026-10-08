import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient, homeFor } from "@/app/_lib/supabase";

export default async function StudentDashboard() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/dashboard");
  if (profile.role !== "student") redirect(homeFor(profile.role));

  const supabase = serverClient();

  const { data: enrolments } = await supabase
    .from("enrolments")
    .select("id, sections(id, number, term, courses(id, title, summary))")
    .eq("student_id", profile.id)
    .eq("status", "active");

  const { data: totals } = await supabase
    .from("section_totals")
    .select("section_id, marked_items, mean_out_of_20");

  const { data: sharedRaw } = await supabase
    .from("submission_shares")
    .select("submission_id, submission:submissions!inner(feedback(author_id))")
    .eq("shared_with", profile.id);
  const waiting = ((sharedRaw ?? []) as any[]).filter(
    (x) => !(x.submission?.feedback ?? []).some((f: any) => f.author_id === profile.id)
  ).length;

  const meanFor = (sectionId: string) =>
    totals?.find((t: any) => t.section_id === sectionId)?.mean_out_of_20 ?? null;

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3>My learning</h3>
          <span className="tiny muted">{profile.full_name}</span>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          {enrolments?.length
            ? "Pick up where you left off."
            : "You are not enrolled in anything yet. Use the join link your teacher sent you."}
        </p>
      </div>

      {waiting > 0 && (
        <Link className="card" href="/shared" style={{ textDecoration: "none", display: "block", borderLeft: "4px solid var(--gold)" }}>
          <div className="spread">
            <h3>Classmates are waiting for your feedback</h3>
            <span className="pill c5">{waiting}</span>
          </div>
          <p className="small muted">Open Shared with me to listen and score their recordings.</p>
        </Link>
      )}

      <div className="grid">
        {enrolments?.map((e: any) => {
          const section = e.sections;
          const course = section?.courses;
          const mean = meanFor(section?.id);
          return (
            <Link key={e.id} className="card" href={`/learn/${course?.id}`} style={{ textDecoration: "none" }}>
              <div className="spread">
                <h3>{course?.title}</h3>
                {mean !== null && <span className="pill">{mean}/20 avg</span>}
              </div>
              <p className="small muted">{course?.summary}</p>
              <div className="tiny muted" style={{ marginTop: 8 }}>
                Section {section?.number} · {section?.term}
              </div>
            </Link>
          );
        })}
      </div>

      {!enrolments?.length && (
        <div className="card">
          <h3>Have a join link?</h3>
          <p className="small muted">
            Open it once and the course appears here. Ask your teacher if you do not have one.
          </p>
        </div>
      )}
    </>
  );
}
