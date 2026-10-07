import { redirect } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import JoinButton from "@/app/_components/JoinButton";

export default async function JoinPage({ params }: { params: { code: string } }) {
  const profile = await currentProfile();
  if (!profile) redirect(`/login?next=/join/${params.code}`);

  const supabase = serverClient();

  const { data: section } = await supabase
    .from("sections")
    .select("id, number, term, invites_open, courses(id, title, summary)")
    .eq("invite_code", params.code.toUpperCase())
    .maybeSingle();

  if (!section) {
    return (
      <div className="card">
        <h3>That join link does not work</h3>
        <p className="small muted">
          The code does not match any section. Ask your teacher for a current link.
        </p>
      </div>
    );
  }

  if (!section.invites_open) {
    return (
      <div className="card">
        <h3>This class is closed to new students</h3>
        <p className="small muted">Ask your teacher to reopen it.</p>
      </div>
    );
  }

  const { data: already } = await supabase
    .from("enrolments")
    .select("id")
    .eq("section_id", section.id)
    .eq("student_id", profile.id)
    .maybeSingle();

  const course = (section as any).courses;

  if (already) redirect(`/learn/${course.id}`);

  return (
    <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
      <h3>{course?.title}</h3>
      <p className="small muted">{course?.summary}</p>
      <p className="tiny muted" style={{ marginTop: 10 }}>
        Section {section.number} · {section.term}
      </p>
      <JoinButton sectionId={section.id} studentId={profile.id} courseId={course?.id} />
    </div>
  );
}
