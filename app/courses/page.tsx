import Link from "next/link";
import { currentProfile, serverClient } from "@/app/_lib/supabase";

export default async function Courses() {
  const profile = await currentProfile();
  const supabase = serverClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, summary")
    .eq("published", true);

  return (
    <>
      <div className="card">
        <h3>Courses</h3>
        <p className="small muted" style={{ marginTop: 6 }}>
          Enrolment is by invitation from the teacher running the section.
        </p>
      </div>

      {courses?.length ? (
        <div className="grid">
          {courses.map((c: any) =>
            profile ? (
              <Link className="card" key={c.id} href={`/learn/${c.id}`} style={{ textDecoration: "none" }}>
                <h3>{c.title}</h3>
                <p className="small muted">{c.summary}</p>
              </Link>
            ) : (
              <div className="card" key={c.id}>
                <h3>{c.title}</h3>
                <p className="small muted">{c.summary}</p>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="card">
          <p className="small muted">No courses have been published yet.</p>
        </div>
      )}
    </>
  );
}
