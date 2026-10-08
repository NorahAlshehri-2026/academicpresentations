import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient, homeFor } from "@/app/_lib/supabase";
import NewSectionForm from "@/app/_components/NewSectionForm";

export default async function NewSection({
  searchParams,
}: {
  searchParams: { course?: string; term?: string };
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/teach/sections/new");
  if (profile.role === "student") redirect(homeFor(profile.role));

  const supabase = serverClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title")
    .eq("published", true)
    .order("title");

  // a sensible default, e.g. "Semester 1, 2026-27" from September onwards
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const defaultTerm =
    m >= 8
      ? `Semester 1, ${y}-${String((y + 1) % 100).padStart(2, "0")}`
      : `Semester 2, ${y - 1}-${String(y % 100).padStart(2, "0")}`;

  return (
    <div className="card" style={{ maxWidth: 520, margin: "24px auto" }}>
      <Link className="btn ghost sm" href="/teach">← Back to teaching</Link>
      <h3 style={{ fontSize: 19, marginTop: 12 }}>Open a class</h3>
      <p className="small muted" style={{ marginTop: 6 }}>
        A class is one group of students you teach. Opening it gives you a link to share with them
        in an announcement or on WhatsApp; they join by opening it, with no invitation email.
      </p>

      <NewSectionForm
        courses={(courses ?? []) as { id: string; title: string }[]}
        teacherId={profile.id}
        defaultTerm={searchParams.term || defaultTerm}
        defaultCourseId={searchParams.course}
      />
    </div>
  );
}
