import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { mmss, fmtDate } from "@/app/_lib/format";

export default async function SharedWithMe() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/shared");

  const supabase = serverClient();
  const { data } = await supabase
    .from("submission_shares")
    .select(
      "created_at, submission:submissions!inner(id, attempt_no, duration_seconds, created_at, " +
        "lesson:lessons(title), owner:profiles!submissions_student_id_fkey(full_name), feedback(author_id))"
    )
    .eq("shared_with", profile.id)
    .order("created_at", { ascending: false });

  const list = ((data ?? []) as any[]).filter((x) => x.submission);
  const waiting = list.filter((x) => !(x.submission.feedback ?? []).some((f: any) => f.author_id === profile.id)).length;

  return (
    <>
      <div className="card">
        <div className="spread">
          <h3>Shared with me</h3>
          {waiting > 0 && <span className="pill c5">{waiting} waiting for you</span>}
        </div>
        <p className="small muted">
          Recordings your classmates have shared with you. Open one, listen, and give feedback on the lesson objectives. The final presentation is scored on the full rubric.
        </p>
      </div>

      <div className="card">
        {list.length ? (
          list.map((x) => {
            const s = x.submission;
            const reviewed = (s.feedback ?? []).some((f: any) => f.author_id === profile.id);
            return (
              <Link key={s.id} className="attrow" href={`/review/${s.id}`}>
                <div className="grow">
                  <div className="small"><b>{s.owner?.full_name ?? "Classmate"}</b> · {s.lesson?.title}</div>
                  <div className="tiny muted">
                    attempt {s.attempt_no} · {mmss(s.duration_seconds)} · shared {fmtDate(x.created_at)}
                  </div>
                </div>
                <span className={`pill ${reviewed ? "c2" : "c5"}`}>{reviewed ? "Reviewed" : "Needs feedback"}</span>
                <span className="muted">›</span>
              </Link>
            );
          })
        ) : (
          <p className="small muted">Nothing has been shared with you yet.</p>
        )}
      </div>
    </>
  );
}
