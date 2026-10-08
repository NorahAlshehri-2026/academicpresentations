import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { unitMeta, MAX_ATTEMPTS } from "@/app/_lib/activities";
import { mmss } from "@/app/_lib/format";

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
    .select("lesson_id, attempt_no")
    .eq("student_id", profile.id);

  const attempts = new Map<string, number>();
  const finalUsed = new Set<string>();
  (submitted ?? []).forEach((s: any) => {
    attempts.set(s.lesson_id, (attempts.get(s.lesson_id) ?? 0) + 1);
    if (s.attempt_no >= MAX_ATTEMPTS) finalUsed.add(s.lesson_id);
  });

  const completed = new Set([
    ...(progress ?? []).map((p: any) => p.lesson_id),
    ...(submitted ?? []).map((s: any) => s.lesson_id),
  ]);

  const units = Array.from(new Set((lessons ?? []).map((l: any) => l.unit))).sort((a, b) => a - b);
  const total = lessons?.length ?? 0;
  const doneCount = (lessons ?? []).filter((l: any) => completed.has(l.id)).length;
  const student = profile.role === "student";

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3 style={{ fontSize: 19 }}>{course.title}</h3>
          {student && <span className="pill">{doneCount} / {total} done</span>}
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>{course.summary}</p>
        {student && (
          <div className="bar" style={{ marginTop: 12 }}>
            <i style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }} />
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
        {units.map((u) => {
          const meta = unitMeta(u);
          const rows = (lessons ?? []).filter((l: any) => l.unit === u);
          return (
            <div className="card ucard" key={u} style={{ borderLeftColor: meta.colour, margin: 0 }}>
              <div className="n">Unit {u}</div>
              <h3 style={{ margin: "4px 0 4px" }}>{meta.title}</h3>
              {meta.blurb && <p className="small muted" style={{ margin: "0 0 6px" }}>{meta.blurb}</p>}
              <div style={{ marginTop: 6 }}>
                {rows.map((l: any) => {
                  const n = attempts.get(l.id) ?? 0;
                  const isPractice = l.kind === "practice";
                  const state = !completed.has(l.id) ? "" : isPractice && !finalUsed.has(l.id) ? "half" : "done";
                  return (
                    <Link key={l.id} href={`/learn/${course.id}/${l.id}`} className="lrow">
                      <span className={`tick ${state}`}>{state === "done" ? "✓" : state === "half" ? "1" : ""}</span>
                      <span className="t">{l.title}</span>
                      {student && isPractice && n > 0 && (
                        <span className={`pill ${finalUsed.has(l.id) ? "c2" : "c5"}`}>
                          {finalUsed.has(l.id) ? `${MAX_ATTEMPTS} of ${MAX_ATTEMPTS} · done` : `${n} of ${MAX_ATTEMPTS} used`}
                        </span>
                      )}
                      <span className="tiny muted" style={{ whiteSpace: "nowrap" }}>
                        {KIND_LABEL[l.kind] ?? l.kind}
                        {l.target_seconds ? ` · ${mmss(l.target_seconds)}` : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
