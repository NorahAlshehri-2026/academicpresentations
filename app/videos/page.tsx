import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentProfile, homeFor } from "@/app/_lib/supabase";
import { canManage, loadVideos, videoCourses, withLinks } from "@/app/_lib/staff-videos";
import { megabytes } from "@/app/_lib/staff-video-types";
import StaffVideoUpload from "@/app/_components/StaffVideoUpload";
import StaffVideoActions from "@/app/_components/StaffVideoActions";

export const metadata: Metadata = { title: "Teacher videos · Foundations of Academic Presentations" };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", year: "numeric" });

/**
 * Teacher videos: for teachers and administrators only. A teacher sees and
 * adds videos for the courses they teach, and renames or deletes the ones they
 * added; an administrator does this for every course and every video.
 * Students never get the tab, are sent home from this page, and cannot open
 * the files.
 */
export default async function TeacherVideos() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/videos");
  if (profile.role === "student") redirect(homeFor(profile.role));

  const isAdmin = profile.role === "admin";
  const courses = await videoCourses(profile);
  const lists = await Promise.all(
    courses.map(async (c) => ({ course: c, videos: await withLinks(c.id, await loadVideos(c.id)) }))
  );
  const count = lists.reduce((n, l) => n + l.videos.length, 0);
  const bytes = lists.reduce((n, l) => n + l.videos.reduce((m, v) => m + (v.size || 0), 0), 0);

  return (
    <>
      <div className="pagehead">
        <h1>Teacher videos</h1>
        <p className="lead">
          For teachers and administrators only. Students cannot see this page or open these videos.
          {isAdmin && count > 0 ? ` ${count} video${count === 1 ? "" : "s"}, ${megabytes(bytes)} in all.` : ""}
        </p>
      </div>

      {courses.length > 0 && <StaffVideoUpload courses={courses} isAdmin={isAdmin} />}

      {!courses.length ? (
        <div className="card">
          <p className="small muted" style={{ margin: 0 }}>
            {isAdmin
              ? "There is no course yet. Videos are added to a course."
              : "You can add and watch videos here for the courses you teach. Open a class under My classes first."}
          </p>
        </div>
      ) : (
        lists.map(({ course, videos }) => (
          <div className="card" key={course.id}>
            <div className="spread">
              <h3>{course.title}</h3>
              <span className="tiny muted" style={{ whiteSpace: "nowrap" }}>
                {videos.length} video{videos.length === 1 ? "" : "s"}
              </span>
            </div>
            {videos.length ? (
              <div className="sv-grid">
                {videos.map((v) => (
                  <div className="sv-item" key={v.id}>
                    {v.src ? (
                      <video className="play" controls playsInline preload="metadata" controlsList="nodownload" src={v.src} />
                    ) : (
                      <p className="small muted">This video could not be loaded. Reload the page to try again.</p>
                    )}
                    <h4>{v.title}</h4>
                    {v.note && <p className="small" style={{ margin: "0 0 4px" }}>{v.note}</p>}
                    <p className="tiny muted" style={{ margin: 0 }}>
                      {megabytes(v.size)} · added {day(v.added)}
                      {v.by ? ` by ${v.by}` : ""}
                    </p>
                    {canManage(profile, v) && <StaffVideoActions courseId={course.id} id={v.id} title={v.title} note={v.note} />}
                  </div>
                ))}
              </div>
            ) : (
              <p className="small muted" style={{ marginTop: 6 }}>
                No videos for this course yet. Add one above.
              </p>
            )}
          </div>
        ))
      )}

      {count > 0 && (
        <p className="tiny muted">If a video stops loading after a few hours, reload the page.</p>
      )}
    </>
  );
}
