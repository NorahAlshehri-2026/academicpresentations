import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentProfile, homeFor } from "@/app/_lib/supabase";
import { canManage, loadSets, videoCourses, withLinks } from "@/app/_lib/staff-videos";
import { MAX_CLIPS, MAX_SETS, megabytes } from "@/app/_lib/staff-video-types";
import StaffVideoUpload from "@/app/_components/StaffVideoUpload";
import StaffVideoSet from "@/app/_components/StaffVideoSet";

export const metadata: Metadata = { title: "Recorded lectures · Foundations of Academic Presentations" };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", year: "numeric" });

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * Recorded lectures (the /videos page): for teachers and administrators only.
 * A course holds up to six recorded lectures, each with up to three videos.
 * A teacher sees and adds lectures for the courses they teach, and changes or
 * deletes the ones they added; an administrator does this for every course and
 * every lecture. "Show to class" plays a lecture's videos full screen for the
 * classroom.
 * Students never get the tab, are sent home from this page, cannot open the
 * files, and the student preview pages never show these videos.
 */
export default async function TeacherVideos() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/videos");
  if (profile.role === "student") redirect(homeFor(profile.role));

  const isAdmin = profile.role === "admin";
  const courses = await videoCourses(profile);
  const lists = await Promise.all(
    courses.map(async (c) => ({ course: c, sets: await withLinks(c.id, await loadSets(c.id)) }))
  );
  const titles = lists.reduce((n, l) => n + l.sets.length, 0);
  const videos = lists.reduce((n, l) => n + l.sets.reduce((m, s) => m + s.clips.length, 0), 0);
  const bytes = lists.reduce(
    (n, l) => n + l.sets.reduce((m, s) => m + s.clips.reduce((k, c) => k + (c.kind === "file" ? c.size || 0 : 0), 0), 0),
    0
  );

  return (
    <>
      <div className="pagehead">
        <h1>Recorded lectures</h1>
        <p className="lead">
          Up to {MAX_SETS} recorded lectures a course, each with up to {MAX_CLIPS} videos. For teachers and administrators only:
          students cannot see this page or open these videos, and they are not part of the student preview. To play a lecture
          for your students, press <b>Show to class</b>.
          {isAdmin && titles > 0
            ? ` ${plural(titles, "lecture")}, ${plural(videos, "video")}${bytes ? ` (${megabytes(bytes)} of uploaded files)` : ""}.`
            : ""}
        </p>
      </div>

      {courses.length > 0 && (
        <StaffVideoUpload courses={lists.map((l) => ({ ...l.course, lectures: l.sets.length }))} isAdmin={isAdmin} />
      )}

      {!courses.length ? (
        <div className="card">
          <p className="small muted" style={{ margin: 0 }}>
            {isAdmin
              ? "There is no course yet. Recorded lectures are added to a course."
              : "You can add and watch recorded lectures here for the courses you teach. Open a class under My classes first."}
          </p>
        </div>
      ) : (
        lists.map(({ course, sets }) => (
          <div className="card" key={course.id}>
            <div className="spread">
              <h3>{course.title}</h3>
              <span className="tiny muted" style={{ whiteSpace: "nowrap" }}>
                {sets.length} of {MAX_SETS} lectures · {plural(sets.reduce((m, s) => m + s.clips.length, 0), "video")}
              </span>
            </div>
            {sets.length ? (
              sets.map((s) => (
                <StaffVideoSet
                  key={s.id}
                  set={s}
                  courseId={course.id}
                  courseTitle={course.title}
                  addedOn={day(s.added)}
                  manage={canManage(profile, s)}
                />
              ))
            ) : (
              <p className="small muted" style={{ marginTop: 6 }}>
                No recorded lectures for this course yet. Add one above, with up to {MAX_CLIPS} videos.
              </p>
            )}
          </div>
        ))
      )}

      {videos > 0 && (
        <p className="tiny muted">If an uploaded video stops loading after a few hours, reload the page.</p>
      )}
    </>
  );
}
