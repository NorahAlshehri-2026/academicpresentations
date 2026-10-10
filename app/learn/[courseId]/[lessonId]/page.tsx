import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { RB } from "@/app/_lib/rubric";
import { FOCUS, CRIT_CLASS, MAX_ATTEMPTS, unitMeta } from "@/app/_lib/activities";
import { mmss, fmtDate, metricsOf, paceLabel } from "@/app/_lib/format";
import Prose from "@/app/_components/Prose";
import PracticeRecorder from "@/app/_components/PracticeRecorder";
import CompleteButton from "@/app/_components/CompleteButton";
import AiFeedbackButton from "@/app/_components/AiFeedbackButton";
import SharePanel from "@/app/_components/SharePanel";
import DeleteAttempt from "@/app/_components/DeleteAttempt";
import MediaPlayer from "@/app/_components/MediaPlayer";
import FeedbackList, { type FeedbackRow } from "@/app/_components/FeedbackList";
import { isVideoPath } from "@/app/_lib/format";
import { PreviewBanner, SampleAttempt } from "@/app/_components/StudentPreview";

export default async function LessonPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  const profile = await currentProfile();
  if (!profile) redirect(`/login?next=/learn/${params.courseId}/${params.lessonId}`);

  const supabase = serverClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, course_id, unit, order_no, kind, title, body, video_url, activity_key, prep_seconds, target_seconds")
    .eq("id", params.lessonId)
    .single();

  if (!lesson) notFound();

  const { data: media } = await supabase
    .from("lesson_media")
    .select("id, kind, title, storage_path, external_url, transcript")
    .eq("lesson_id", lesson.id)
    .order("order_no");

  const { data: done } = await supabase
    .from("lesson_progress")
    .select("completed_at")
    .eq("lesson_id", lesson.id)
    .eq("student_id", profile.id)
    .maybeSingle();

  const isPractice = lesson.kind === "practice";
  const target = lesson.target_seconds ?? 120;
  const focus = FOCUS[lesson.activity_key ?? ""] ?? [];
  const meta = unitMeta(lesson.unit);

  const header = (
    <div className="card">
      <Link className="btn ghost sm" href={isPractice ? "/activities" : "/units"}>
        ← {isPractice ? "All activities" : "The units"}
      </Link>
      <div className="spread" style={{ marginTop: 12 }}>
        <h3 style={{ fontSize: 19 }}>{lesson.title}</h3>
        <span className="pill" style={{ background: meta.colour, color: "#fff" }}>Unit {lesson.unit}</span>
      </div>
      {isPractice && (
        <p className="tiny muted" style={{ marginTop: 6 }}>
          Prepare {mmss(lesson.prep_seconds ?? 0)} · speak {mmss(target)} · two attempts
        </p>
      )}
      <div style={{ marginTop: 12 }} className="lesson-body">
        <Prose text={lesson.body} />
      </div>
      {focus.length > 0 && (
        <div className="row" style={{ marginTop: 12 }}>
          {focus.map((f) => (
            <span key={f} className={`pill ${CRIT_CLASS[f]}`}>
              {RB[f].n}. {RB[f].name.split(" and ")[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const mediaCards = (
    <>
      {media?.map((m: any) => (
        <div className="card" key={m.id}>
          <h3>{m.title}</h3>
          <div style={{ marginTop: 10 }}>
            {m.external_url ? (
              <MediaPlayer src={m.external_url} video={m.kind === "video"} />
            ) : (
              <MediaFromStorage path={m.storage_path} kind={m.kind} />
            )}
          </div>
          {m.transcript && (
            <details style={{ marginTop: 10 }}>
              <summary className="small muted" style={{ cursor: "pointer" }}>Transcript</summary>
              <div style={{ marginTop: 8 }}><Prose text={m.transcript} /></div>
            </details>
          )}
        </div>
      ))}
      {lesson.kind === "video" && lesson.video_url && (
        <div className="card">
          <VideoEmbed url={lesson.video_url} />
          <p className="tiny muted" style={{ marginTop: 8 }}>
            <a href={lesson.video_url} target="_blank" rel="noreferrer">Watch on YouTube</a>
          </p>
        </div>
      )}
    </>
  );

  const staff = profile.role !== "student";

  if (!isPractice) {
    return (
      <>
        {staff && <PreviewBanner />}
        {header}
        {mediaCards}
        {staff ? (
          <div className="card">
            <button className="btn block" disabled>Mark as complete</button>
            <p className="tiny muted center" style={{ marginTop: 6 }}>Students tick off reading and video lessons here.</p>
          </div>
        ) : (
          <CompleteButton lessonId={lesson.id} studentId={profile.id} done={!!done} />
        )}
      </>
    );
  }

  // ---- speaking task -------------------------------------------------------

  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("section_id, sections!inner(course_id)")
    .eq("student_id", profile.id)
    .eq("status", "active")
    .eq("sections.course_id", lesson.course_id)
    .limit(1)
    .maybeSingle();

  const sectionId = (enrolment as any)?.section_id ?? null;

  const { data: mineRaw } = await supabase
    .from("submissions")
    .select(
      "id, attempt_no, transcript, duration_seconds, file_path, file_purged_at, created_at, section_id, " +
        "feedback(id, source, author_id, scores, strengths, improve, created_at, author:profiles!feedback_author_id_fkey(full_name)), " +
        "submission_shares(shared_with)"
    )
    .eq("lesson_id", lesson.id)
    .eq("student_id", profile.id)
    .order("attempt_no");

  const mine = (mineRaw ?? []) as any[];
  const ids = mine.map((s) => s.id);

  const { data: marks } = ids.length
    ? await supabase.from("current_grades").select("submission_id, total, per_criterion, comment, created_at").in("submission_id", ids)
    : { data: [] as any[] };

  const markFor = (id: string) => (marks ?? []).find((m: any) => m.submission_id === id) ?? null;

  const { data: classmatesRaw } = sectionId
    ? await supabase.rpc("classmates_in_section", { section: sectionId })
    : { data: [] as any[] };
  const classmates = (classmatesRaw ?? []) as { id: string; full_name: string }[];

  const signed = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("recordings").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const attempts = await Promise.all(mine.map(async (s) => ({ ...s, url: await signed(s.file_path) })));

  // recordings of this task that classmates have shared with me
  const { data: sharedRaw } = await supabase
    .from("submission_shares")
    .select(
      "created_at, submission:submissions!inner(id, lesson_id, attempt_no, duration_seconds, created_at, " +
        "owner:profiles!submissions_student_id_fkey(full_name), feedback(author_id))"
    )
    .eq("shared_with", profile.id)
    .eq("submission.lesson_id", lesson.id);
  const shared = ((sharedRaw ?? []) as any[]).filter((x) => x.submission);

  const usedFinal = mine.some((s) => s.attempt_no >= MAX_ATTEMPTS);
  const nextAttempt = usedFinal ? 0 : mine.some((s) => s.attempt_no === 1) ? 2 : 1;

  // staff who are not in a class of this course see the student view without saving
  const previewOnly = staff && !sectionId;

  return (
    <>
      {staff && <PreviewBanner saving={!previewOnly} />}
      {header}
      {mediaCards}

      {previewOnly ? (
        <>
          <PracticeRecorder
            lessonId={lesson.id}
            sectionId=""
            studentId={profile.id}
            prepSeconds={lesson.prep_seconds ?? 120}
            targetSeconds={target}
            nextAttempt={1}
            preview
          />
          <SampleAttempt target={target} />
        </>
      ) : !sectionId ? (
        <div className="card">
          <h3>Not in a class yet</h3>
          <p className="small muted">
            Recordings belong to a class, so you need to join one before you can record. Open the class link from
            your teacher.
          </p>
        </div>
      ) : nextAttempt === 0 ? (
        <div className="card">
          <h3>Both attempts used</h3>
          <p className="small muted">
            You have saved your two attempts for this task. Share them with a classmate below, or ask for AI feedback
            once someone has scored you.
          </p>
        </div>
      ) : (
        <PracticeRecorder
          key={`attempt-${nextAttempt}-${mine.length}`}
          lessonId={lesson.id}
          sectionId={sectionId}
          studentId={profile.id}
          prepSeconds={lesson.prep_seconds ?? 120}
          targetSeconds={target}
          nextAttempt={nextAttempt}
        />
      )}

      {attempts.map((s) => {
        const fb = (s.feedback ?? []) as FeedbackRow[];
        const m = metricsOf(s.transcript, s.duration_seconds ?? 0, target);
        const mark = markFor(s.id);
        const isFinal = s.attempt_no >= MAX_ATTEMPTS;
        return (
          <div className="card" key={s.id} id={`attempt-${s.attempt_no}`}>
            <div className="spread">
              <h3>Attempt {s.attempt_no}</h3>
              <span className={`pill ${isFinal ? "c3" : "c5"}`}>{isFinal ? "Final" : "Attempt 1"}</span>
            </div>
            <div className="meta">
              {mmss(s.duration_seconds)} of {mmss(target)} · {fmtDate(s.created_at)}
            </div>

            <div style={{ marginTop: 10 }}>
              {s.url ? (
                <MediaPlayer src={s.url} video={isVideoPath(s.file_path)} />
              ) : (
                <p className="small muted">
                  {s.file_purged_at ? "The audio was deleted under the one-year retention policy." : "The file could not be loaded."}
                </p>
              )}
            </div>

            <div className="note" style={{ marginTop: 10 }}>
              <b>{mmss(m.secs)}</b> spoken · target {mmss(m.target)} — <b>{m.timing}</b>
              {m.wpm ? <> · about <b>{m.wpm}</b> words per minute ({paceLabel(m.wpm)})</> : null}
              {m.words ? <> · {m.fillers} filler word{m.fillers === 1 ? "" : "s"}</> : null}
            </div>

            {s.transcript && (
              <details style={{ marginTop: 10 }}>
                <summary className="small" style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)" }}>Transcript</summary>
                <p className="small" style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{s.transcript}</p>
              </details>
            )}

            <div className="row" style={{ marginTop: 12 }}>
              {isFinal ? (
                <span className="lock">🔒 Final attempt · kept, cannot be deleted</span>
              ) : !mark ? (
                <DeleteAttempt submissionId={s.id} filePath={s.file_path} />
              ) : (
                <span className="lock">Marked, so it is kept</span>
              )}
            </div>

            <SharePanel
              submissionId={s.id}
              classmates={classmates}
              sharedWith={(s.submission_shares ?? []).map((x: any) => x.shared_with)}
            />

            <div className="sep">
              <h3 style={{ fontSize: 14 }}>Feedback</h3>
              <FeedbackList
                feedback={fb}
                mark={mark}
                viewerId={profile.id}
                emptyText="None yet. Share this recording with a classmate and their scores appear here."
              />
              <AiFeedbackButton
                submissionId={s.id}
                hasPeer={fb.some((f) => f.source === "peer" || f.source === "teacher")}
                hasAi={fb.some((f) => f.source === "ai")}
                hasTranscript={!!s.transcript?.trim()}
                auto={process.env.AI_FEEDBACK_AUTO === "on" && !!process.env.ANTHROPIC_API_KEY}
              />
            </div>
          </div>
        );
      })}

      {shared.length > 0 && (
        <div className="card">
          <h3>Shared with you for this task</h3>
          <p className="small muted">Listen, then give feedback.</p>
          <div style={{ marginTop: 6 }}>
            {shared.map((x: any) => {
              const s = x.submission;
              const reviewed = (s.feedback ?? []).some((f: any) => f.author_id === profile.id);
              return (
                <Link key={s.id} className="attrow" href={`/review/${s.id}`}>
                  <div className="grow">
                    <b className="small">{s.owner?.full_name ?? "Classmate"}</b>
                    <div className="tiny muted">attempt {s.attempt_no} · {mmss(s.duration_seconds)} · shared {fmtDate(x.created_at)}</div>
                  </div>
                  <span className={`pill ${reviewed ? "c2" : "c5"}`}>{reviewed ? "Reviewed" : "Needs feedback"}</span>
                  <span className="muted">›</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

async function MediaFromStorage({ path, kind }: { path: string | null; kind: string }) {
  if (!path) return null;
  const supabase = serverClient();
  const { data } = await supabase.storage.from("media").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return <p className="small muted">This file could not be loaded.</p>;
  return <MediaPlayer src={data.signedUrl} video={kind === "video"} />;
}

function VideoEmbed({ url }: { url: string }) {
  const id =
    url.match(/[?&]v=([\w-]{11})/)?.[1] ??
    url.match(/youtu\.be\/([\w-]{11})/)?.[1] ??
    url.match(/embed\/([\w-]{11})/)?.[1];

  if (!id) return <video className="play" controls src={url} />;

  return (
    <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden" }}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="Lesson video"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
}
