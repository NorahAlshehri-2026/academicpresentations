import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, homeFor } from "@/app/_lib/supabase";
import { loadCourse } from "@/app/_lib/course";
import { latestCoursebook } from "@/app/_lib/coursebook";
import { versionDate } from "@/app/_lib/coursebook-types";
import CoursebookUpload from "@/app/_components/CoursebookUpload";
import AnswerKeyUpload from "@/app/_components/AnswerKeyUpload";
import { loadAnswerKey } from "@/app/_lib/answer-key";

export default async function CoursebookAdmin() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/admin/coursebook");
  if (profile.role !== "admin") redirect(homeFor(profile.role));

  const { course } = await loadCourse();
  const live = course ? await latestCoursebook(course.id) : null;
  const answers = course ? await loadAnswerKey(course.id) : null;
  const when = live ? versionDate(live.version) : null;

  return (
    <>
      <div className="pagehead">
        <h1>Coursebook files</h1>
        <p className="lead">The pages, listening tracks and PDF that students open under Coursebook.</p>
      </div>

      <div className="card">
        <h3>Now showing</h3>
        {!course ? (
          <p className="small muted">There is no course yet.</p>
        ) : live ? (
          <p className="small" style={{ margin: 0 }}>
            {live.manifest.pages.length} pages and {Object.keys(live.manifest.tracks).length} listening tracks, uploaded{" "}
            {when
              ? when.toLocaleString("en-GB", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : live.version}
            . <Link href="/coursebook">Open the coursebook</Link>
          </p>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>Nothing yet. Upload the coursebook folder below.</p>
        )}
        <p className="tiny muted" style={{ marginTop: 10 }}>
          The files are kept in the private <b>media</b> storage, so only signed-in students and staff of this course can
          open them. To change the coursebook later, upload a new folder: students see the newest complete upload, and
          earlier uploads stay in storage until you delete them in Supabase.
        </p>
      </div>

      {course && <CoursebookUpload courseId={course.id} />}

      {course && <AnswerKeyUpload count={answers?.items.length ?? 0} updated={answers?.updated ?? null} />}

      <p className="small">
        <Link href="/admin">Back to Admin</Link>
      </p>
    </>
  );
}
