import "server-only";
import { serverClient } from "./supabase";

export type LessonRow = {
  id: string;
  course_id: string;
  unit: number;
  order_no: number;
  kind: string;
  title: string;
  body: string | null;
  activity_key: string | null;
  prep_seconds: number | null;
  target_seconds: number | null;
};

/**
 * The presentations course and its lessons, as the signed-in person may see
 * them (students: the course they are enrolled in; staff: the one they teach
 * or administer). Prefers the course with the "academic-presentations" slug.
 */
export async function loadCourse() {
  const supabase = serverClient();
  const { data: courses } = await supabase.from("courses").select("id, title, slug, summary").order("created_at");
  const course =
    (courses ?? []).find((c: any) => c.slug === "academic-presentations") ?? (courses ?? [])[0] ?? null;
  if (!course) return { course: null, lessons: [] as LessonRow[] };
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds")
    .eq("course_id", course.id)
    .order("unit")
    .order("order_no");
  return { course: course as { id: string; title: string; slug: string; summary: string | null }, lessons: (lessons ?? []) as LessonRow[] };
}
