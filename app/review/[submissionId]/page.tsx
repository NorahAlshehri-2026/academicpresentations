import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { mmss, fmtDate, metricsOf, paceLabel, isVideoPath } from "@/app/_lib/format";
import { MAX_ATTEMPTS } from "@/app/_lib/activities";
import Prose from "@/app/_components/Prose";
import MediaPlayer from "@/app/_components/MediaPlayer";
import PeerFeedback from "@/app/_components/PeerFeedback";
import MarkForm from "@/app/_components/MarkForm";
import FeedbackList, { type FeedbackRow } from "@/app/_components/FeedbackList";

/**
 * One recording, opened by someone who is not its owner: a classmate it was
 * shared with (who can score it), or the class teacher or an administrator
 * (who can mark it). Access is decided by the database; a recording that is
 * neither shared with you nor in your class simply is not found.
 */
export default async function ReviewPage({ params }: { params: { submissionId: string } }) {
  const profile = await currentProfile();
  if (!profile) redirect(`/login?next=/review/${params.submissionId}`);

  const supabase = serverClient();
  const { data: s } = await supabase
    .from("submissions")
    .select(
      "id, student_id, section_id, attempt_no, transcript, duration_seconds, file_path, file_purged_at, created_at, " +
        "lesson:lessons(id, course_id, title, body, target_seconds), " +
        "owner:profiles!submissions_student_id_fkey(full_name), " +
        "feedback(id, source, author_id, scores, strengths, improve, created_at, author:profiles!feedback_author_id_fkey(full_name))"
    )
    .eq("id", params.submissionId)
    .maybeSingle();

  const back = profile.role === "student" ? "/shared" : "/teach";

  if (!s) {
    return (
      <div className="card narrow">
        <h3>Recording not available</h3>
        <p className="small muted">It may have been deleted, or it has not been shared with you.</p>
        <Link className="btn ghost sm" href={back} style={{ marginTop: 10 }}>Back</Link>
      </div>
    );
  }

  const sub = s as any;
  if (sub.student_id === profile.id) redirect(`/learn/${sub.lesson?.course_id}/${sub.lesson?.id}`);

  const target = sub.lesson?.target_seconds ?? 120;
  const m = metricsOf(sub.transcript, sub.duration_seconds ?? 0, target);
  const fb = (sub.feedback ?? []) as FeedbackRow[];
  const mine = fb.find((f) => f.author_id === profile.id) ?? null;

  const { data: urlData } = sub.file_path
    ? await supabase.storage.from("recordings").createSignedUrl(sub.file_path, 3600)
    : { data: null };

  const { data: mark } = await supabase
    .from("current_grades")
    .select("total, per_criterion, comment, created_at")
    .eq("submission_id", sub.id)
    .maybeSingle();

  const { data: teaches } = await supabase.from("sections").select("id").eq("id", sub.section_id).eq("teacher_id", profile.id).maybeSingle();
  const canMark = !!teaches || profile.role === "admin";

  return (
    <>
      <div className="card">
        <Link className="btn ghost sm" href={canMark ? `/teach/sections/${sub.section_id}/students/${sub.student_id}` : back}>
          ← {canMark ? "Back to the student" : "Shared with me"}
        </Link>
        <div className="spread" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 18 }}>{sub.owner?.full_name ?? "Student"}</h3>
          <span className={`pill ${sub.attempt_no >= MAX_ATTEMPTS ? "c3" : "c5"}`}>Attempt {sub.attempt_no}</span>
        </div>
        <div className="meta">
          {sub.lesson?.title} · {mmss(sub.duration_seconds)} of {mmss(target)} · {fmtDate(sub.created_at)}
        </div>

        <div style={{ marginTop: 12 }}>
          {urlData?.signedUrl ? (
            <MediaPlayer src={urlData.signedUrl} video={isVideoPath(sub.file_path)} />
          ) : (
            <p className="small muted">
              {sub.file_purged_at ? "The audio was deleted under the one-year retention policy." : "The file could not be loaded."}
            </p>
          )}
        </div>

        <div className="note" style={{ marginTop: 10 }}>
          <b>{mmss(m.secs)}</b> spoken · target {mmss(m.target)} — <b>{m.timing}</b>
          {m.wpm ? <> · about <b>{m.wpm}</b> words per minute ({paceLabel(m.wpm)})</> : null}
          {m.words ? <> · {m.fillers} filler word{m.fillers === 1 ? "" : "s"}</> : null}
        </div>

        {sub.transcript && (
          <details style={{ marginTop: 10 }}>
            <summary className="small" style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)" }}>Transcript</summary>
            <p className="small" style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{sub.transcript}</p>
          </details>
        )}
        <details style={{ marginTop: 10 }}>
          <summary className="small" style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)" }}>The task</summary>
          <div style={{ marginTop: 8 }} className="lesson-body"><Prose text={sub.lesson?.body ?? null} /></div>
        </details>
      </div>

      {canMark ? (
        <MarkForm
          submissionId={sub.id}
          markerId={profile.id}
          existing={mine}
          alreadyMarked={mark ? (mark as any).total : null}
        />
      ) : (
        <PeerFeedback submissionId={sub.id} authorId={profile.id} existing={mine} />
      )}

      <div className="card">
        <h3>{canMark ? "All feedback" : "Feedback"}</h3>
        <FeedbackList
          feedback={canMark ? fb : fb.filter((f) => f.author_id === profile.id)}
          mark={canMark ? (mark as any) : null}
          viewerId={profile.id}
          emptyText="No feedback yet."
        />
      </div>
    </>
  );
}
