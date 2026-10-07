import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const KIND_LABEL: Record<string, string> = {
  reading: "Read",
  video: "Watch",
  audio: "Listen",
  practice: "Record",
  quiz: "Test",
};

export default async function CoursePage({ params }: { params: { courseId: string } }) {
  const profile = await currentProfile();
  if (!profile) redirect(`/login?next=/learn/${params.courseId}`);

  const supabase = serverClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, summary")
    .eq("id", params.courseId)
    .single();

  if (!course) notFound();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, unit, order_no, kind, title, target_seconds")
    .eq("course_id", course.id)
    .order("unit")
    .order("order_no");

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("student_id", profile.id);

  const { data: submitted } = await supabase
    .from("submissions")
    .select("lesson_id")
    .eq("student_id", profile.id);

  const completed = new Set([
    ...(progress ?? []).map((p: any) => p.lesson_id),
    ...(submitted ?? []).map((s: any) => s.lesson_id),
  ]);

  const units = Array.from(new Set((lessons ?? []).map((l: any) => l.unit))).sort();
  const total = lessons?.length ?? 0;
  const doneCount = (lessons ?? []).filter((l: any) => completed.has(l.id)).length;

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3 style={{ fontSize: 19 }}>{course.title}</h3>
          <span className="pill">{doneCount} / {total} done</span>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>{course.summary}</p>
        <div className="bar" style={{ marginTop: 12 }}>
          <i style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }} />
        </div>
      </div>

      {units.map((u) => (
        <div className="card" key={u}>
          <h3>Unit {u}</h3>
          <div style={{ marginTop: 10 }}>
            {(lessons ?? [])
              .filter((l: any) => l.unit === u)
              .map((l: any) => {
                const isDone = completed.has(l.id);
                return (
                  <Link
                    key={l.id}
                    href={`/learn/${course.id}/${l.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 0",
                      borderTop: "1px solid var(--rule)",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        flex: "none",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 800,
                        background: isDone ? "var(--green)" : "var(--tint)",
                        color: isDone ? "#fff" : "var(--muted)",
                      }}
                    >
                      {isDone ? "✓" : ""}
                    </span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{l.title}</span>
                    <span className="tiny muted">
                      {KIND_LABEL[l.kind] ?? l.kind}
                      {l.target_seconds ? ` · ${mmss(l.target_seconds)}` : ""}
                    </span>
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </>
  );
}
