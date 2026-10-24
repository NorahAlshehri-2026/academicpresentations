import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile } from "@/app/_lib/supabase";
import { loadCourse } from "@/app/_lib/course";
import { signedCoursebook } from "@/app/_lib/coursebook";
import { loadAnswerKey } from "@/app/_lib/answer-key";
import CoursebookViewer from "@/app/_components/CoursebookViewer";

/**
 * The workbook as online pages. ?page=7 opens at a page, ?track=16 at the page
 * of a recording, ?at=u3-1-4 at an exercise (Unit 3, exercise 1.4).
 */
export default async function CoursebookPage({ searchParams }: { searchParams?: { page?: string; track?: string; at?: string } }) {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/coursebook");

  const { course } = await loadCourse();
  const found = course ? await signedCoursebook(course.id) : null;

  if (!course || !found) {
    return (
      <>
        <div className="pagehead">
          <h1>Coursebook</h1>
          <p className="lead">The workbook for the course, page by page, with its listening tracks.</p>
        </div>
        <div className="card">
          {!course ? (
            <p className="small muted">You are not in a class yet. Open the class link your teacher shared to join.</p>
          ) : profile.role === "admin" ? (
            <p className="small">
              The coursebook has not been uploaded yet. <Link href="/admin/coursebook">Upload the coursebook files</Link>.
            </p>
          ) : (
            <p className="small muted">The coursebook is not available yet. Your teacher will let you know when it is.</p>
          )}
        </div>
      </>
    );
  }

  const { book } = found;
  // teachers and administrators only: the answer key never reaches a student's browser
  const answers = profile.role === "student" ? [] : (await loadAnswerKey(course.id))?.items ?? [];
  const total = book.pages.length;
  const num = (v?: string) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) && n >= 1 && n <= total ? n : undefined;
  };
  const startPage =
    num(searchParams?.page) ??
    (searchParams?.track ? book.tracks[searchParams.track]?.page ?? undefined : undefined) ??
    (searchParams?.at ? book.anchors[searchParams.at] : undefined);

  return (
    <>
      <div className="pagehead">
        <h1>Coursebook</h1>
        <p className="lead">
          {total} pages · {Object.keys(book.tracks).length} listening tracks
          {profile.role === "admin" && (
            <>
              {" · "}
              <Link href="/admin/coursebook" className="small">Update the files</Link>
            </>
          )}
        </p>
      </div>
      <CoursebookViewer book={book} startPage={startPage} answers={answers} />
    </>
  );
}
