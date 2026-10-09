import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile } from "@/app/_lib/supabase";
import { loadCourse } from "@/app/_lib/course";
import { unitMeta } from "@/app/_lib/activities";
import { PreviewBanner } from "@/app/_components/StudentPreview";

export default async function UnitsPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/units");

  const { course, lessons } = await loadCourse();
  const units = Array.from(new Set(lessons.map((l) => l.unit))).sort((a, b) => a - b);

  return (
    <>
      {profile.role !== "student" && <PreviewBanner />}
      <div className="card">
        <h3>The {units.length === 5 ? "five" : units.length} units</h3>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          Each unit of the workbook has a short reading and speaking activities that practise what it teaches.
        </p>
      </div>

      {!course ? (
        <div className="card">
          <p className="small muted">You are not in a class yet. Open the class link your teacher shared to join.</p>
        </div>
      ) : (
        <div className="grid">
          {units.map((u) => {
            const meta = unitMeta(u);
            const rows = lessons.filter((l) => l.unit === u);
            const reads = rows.filter((l) => l.kind !== "practice");
            const acts = rows.filter((l) => l.kind === "practice");
            return (
              <div className="card ucard" key={u} style={{ borderLeftColor: meta.colour, margin: 0 }}>
                <div className="n">Unit {u}</div>
                <h3 style={{ margin: "4px 0 6px" }}>{meta.title}</h3>
                {meta.blurb && <p className="small muted">{meta.blurb}</p>}
                {reads.length > 0 && (
                  <p className="tiny muted" style={{ marginTop: 8 }}>
                    Read first:{" "}
                    {reads.map((l, i) => (
                      <span key={l.id}>
                        {i > 0 && " · "}
                        <Link href={`/learn/${course.id}/${l.id}`}>{l.title}</Link>
                      </span>
                    ))}
                  </p>
                )}
                <div className="row" style={{ marginTop: 10 }}>
                  {acts.map((l) => (
                    <Link key={l.id} className="btn ghost sm" href={`/learn/${course.id}/${l.id}`}>
                      {l.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
