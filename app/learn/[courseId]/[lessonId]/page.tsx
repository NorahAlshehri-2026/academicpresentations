import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { RUBRIC, RB, totalOf, band } from "@/app/_lib/rubric";
import Prose from "@/app/_components/Prose";
import PracticeRecorder from "@/app/_components/PracticeRecorder";
import PeerFeedback from "@/app/_components/PeerFeedback";
import CompleteButton from "@/app/_components/CompleteButton";
import AiFeedbackButton from "@/app/_components/AiFeedbackButton";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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

  // which section is this person in for this course?
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("section_id, sections!inner(course_id)")
    .eq("student_id", profile.id)
    .eq("status", "active")
    .eq("sections.course_id", lesson.course_id)
    .maybeSingle();

  const sectionId = (enrolment as any)?.section_id ?? null;

  // this person's attempts at this lesson
  const { data: mine } = await supabase
    .from("submissions")
    .select("id, attempt_no, transcript, duration_seconds, file_path, created_at")
    .eq("lesson_id", lesson.id)
    .eq("student_id", profile.id)
    .order("created_at", { ascending: false });

  const latest = mine?.[0] ?? null;

  const { data: feedback } = latest
    ? await supabase
        .from("feedback")
        .select("id, source, scores, strengths, improve, created_at, author_id")
        .eq("submission_id", latest.id)
        .order("created_at", { ascending: false })
    : { data: null };

  // classmates' attempts, so a partner can be reviewed
  const { data: othersRaw } = sectionId
    ? await supabase
        .from("submissions")
        .select("id, student_id, created_at, duration_seconds, file_path")
        .eq("lesson_id", lesson.id)
        .eq("section_id", sectionId)
        .neq("student_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: null };

  const { data: done } = await supabase
    .from("lesson_progress")
    .select("completed_at")
    .eq("lesson_id", lesson.id)
    .eq("student_id", profile.id)
    .maybeSingle();

  const signed = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("recordings").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const latestUrl = await signed(latest?.file_path ?? null);

  const others = await Promise.all(
    (othersRaw ?? []).map(async (s: any) => ({ ...s, url: await signed(s.file_path) }))
  );

  const focus = RUBRIC; // every practice task is marked on all five

  return (
    <>
      <div className="card">
        <Link className="btn ghost sm" href={`/learn/${lesson.course_id}`}>
          ← Back to the course
        </Link>
        <div className="spread" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 19 }}>{lesson.title}</h3>
          <span className="pill">Unit {lesson.unit}</span>
        </div>
        {lesson.kind === "practice" && lesson.target_seconds && (
          <p className="tiny muted" style={{ marginTop: 6 }}>
            Prepare {mmss(lesson.prep_seconds ?? 0)} · speak {mmss(lesson.target_seconds)}
          </p>
        )}
        <div style={{ marginTop: 12 }}>
          <Prose text={lesson.body} />
        </div>
      </div>

      {/* uploaded audio and video */}
      {media?.map((m: any) => (
        <div className="card" key={m.id}>
          <h3>{m.title}</h3>
          {m.external_url ? (
            m.kind === "video" ? (
              <video className="play" controls src={m.external_url} style={{ marginTop: 10 }} />
            ) : (
              <audio controls src={m.external_url} style={{ marginTop: 10 }} />
            )
          ) : (
            <MediaFromStorage path={m.storage_path} kind={m.kind} />
          )}
          {m.transcript && (
            <details style={{ marginTop: 10 }}>
              <summary className="small muted" style={{ cursor: "pointer" }}>Transcript</summary>
              <div style={{ marginTop: 8 }}><Prose text={m.transcript} /></div>
            </details>
          )}
        </div>
      ))}

      {/* video lesson with a link rather than an upload */}
      {lesson.kind === "video" && lesson.video_url && (
        <div className="card">
          <VideoEmbed url={lesson.video_url} />
          <p className="tiny muted" style={{ marginTop: 8 }}>
            <a href={lesson.video_url} target="_blank" rel="noreferrer">Watch on YouTube</a>
          </p>
        </div>
      )}

      {/* the practice studio */}
      {lesson.kind === "practice" && (
        <>
          {!sectionId ? (
            <div className="card">
              <h3>Not enrolled in a section</h3>
              <p className="small muted">
                Recordings belong to a class, so you need to be enrolled in a section of this course
                before you can submit one. Ask your teacher for a join link.
              </p>
            </div>
          ) : (
            <PracticeRecorder
              lessonId={lesson.id}
              sectionId={sectionId}
              studentId={profile.id}
              prepSeconds={lesson.prep_seconds ?? 120}
              targetSeconds={lesson.target_seconds ?? 120}
              attemptNo={(mine?.length ?? 0) + 1}
            />
          )}

          {latest && (
            <div className="card">
              <div className="spread">
                <h3>Your latest attempt</h3>
                <span className="tiny muted">
                  attempt {latest.attempt_no} · {mmss(latest.duration_seconds ?? 0)} ·{" "}
                  {new Date(latest.created_at).toLocaleDateString()}
                </span>
              </div>
              {latestUrl && <audio controls src={latestUrl} style={{ marginTop: 10 }} />}

              <div style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 14 }}>Feedback</h3>
                {feedback?.length ? (
                  feedback.map((f: any) => {
                    const t = totalOf(f.scores);
                    return (
                      <div
                        key={f.id}
                        style={{ borderTop: "1px solid var(--rule)", paddingTop: 10, marginTop: 10 }}
                      >
                        <div className="spread">
                          <b className="small">
                            {f.source === "ai" ? "AI" : f.source === "teacher" ? "Teacher" : "Partner"}
                          </b>
                          {t !== null && <span className="pill">{t}/20</span>}
                        </div>
                        {RUBRIC.filter((c) => f.scores?.[c.id]).map((c) => (
                          <div className="score-row" key={c.id}>
                            <span className="nm">{c.n}. {c.name}</span>
                            <div className="rbar"><i style={{ width: `${(f.scores[c.id] / 4) * 100}%` }} /></div>
                            <b className="small">{f.scores[c.id]}</b>
                          </div>
                        ))}
                        {f.strengths && <p className="small"><b>Strengths:</b> {f.strengths}</p>}
                        {f.improve && <p className="small"><b>Work on:</b> {f.improve}</p>}
                      </div>
                    );
                  })
                ) : (
                  <p className="small muted">
                    None yet. A classmate in your section can score this, and you can ask for AI feedback
                    once they have.
                  </p>
                )}
              </div>

              <AiFeedbackButton
                submissionId={latest.id}
                hasPeer={!!feedback?.some((f: any) => f.source === "peer" || f.source === "teacher")}
                hasAi={!!feedback?.some((f: any) => f.source === "ai")}
                hasTranscript={!!latest.transcript?.trim()}
              />
            </div>
          )}

          {others.length > 0 && (
            <div className="card">
              <h3>Review a classmate</h3>
              <p className="small muted">
                Listen, then score against the rubric. You cannot score your own recording.
              </p>
              {others.map((s: any) => (
                <details key={s.id} style={{ marginTop: 12 }}>
                  <summary className="small" style={{ cursor: "pointer", fontWeight: 600 }}>
                    An attempt from {new Date(s.created_at).toLocaleDateString()} · {mmss(s.duration_seconds ?? 0)}
                  </summary>
                  <div style={{ marginTop: 10 }}>
                    {s.url && <audio controls src={s.url} />}
                    <PeerFeedback
                      submissionId={s.id}
                      authorId={profile.id}
                      source={profile.role === "student" ? "peer" : "teacher"}
                    />
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}

      {/* reading and video lessons are marked complete by hand */}
      {lesson.kind !== "practice" && (
        <CompleteButton lessonId={lesson.id} studentId={profile.id} done={!!done} />
      )}
    </>
  );
}

async function MediaFromStorage({ path, kind }: { path: string | null; kind: string }) {
  if (!path) return null;
  const supabase = serverClient();
  const { data } = await supabase.storage.from("media").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return <p className="small muted">This file could not be loaded.</p>;
  return kind === "video" ? (
    <video className="play" controls src={data.signedUrl} style={{ marginTop: 10 }} />
  ) : (
    <audio controls src={data.signedUrl} style={{ marginTop: 10 }} />
  );
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
