import Link from "next/link";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import { RUBRIC } from "@/app/_lib/rubric";
import { firstName } from "@/app/_lib/format";

export default async function Home() {
  let profile = null;
  try {
    profile = await currentProfile();
  } catch {}

  const student = profile?.role === "student";
  let done = 0;
  let waiting = 0;
  if (profile && student) {
    const supabase = serverClient();
    const [{ data: subs }, { data: shared }] = await Promise.all([
      supabase.from("submissions").select("lesson_id, lesson:lessons!inner(kind)").eq("student_id", profile.id).eq("lesson.kind", "practice"),
      supabase
        .from("submission_shares")
        .select("submission_id, submission:submissions!inner(feedback(author_id))")
        .eq("shared_with", profile.id),
    ]);
    done = new Set((subs ?? []).map((s: any) => s.lesson_id)).size;
    waiting = ((shared ?? []) as any[]).filter(
      (x) => !(x.submission?.feedback ?? []).some((f: any) => f.author_id === profile!.id)
    ).length;
  }

  return (
    <>
      {profile && !student ? (
        <section className="hero">
          <h2>Welcome back, {firstName(profile.full_name)}.</h2>
          <p>
            Your classes, their join links and every student recording are under My classes. Units and Activities
            show you exactly what your students see.
          </p>
          <div className="row">
            <Link className="btn gold" href="/teach">Open my classes</Link>
            <Link className="btn ghost" href="/activities">Student preview</Link>
          </div>
          <div className="stats">
            <div><b>10</b><span>activities</span></div>
            <div><b>2</b><span>attempts each</span></div>
            <div><b>20</b><span>marks</span></div>
          </div>
        </section>
      ) : (
        <section className="hero">
          <h2>Practise your presentation until it sounds right.</h2>
          <p>
            Ten timed activities from the course workbook. Record yourself, share it with a classmate for feedback
            against the rubric, then ask for a second opinion from AI.
          </p>
          <div className="row">
            <Link className="btn gold" href={profile ? "/activities" : "/login"}>
              {profile ? "Start practising" : "Sign in"}
            </Link>
            <Link className="btn ghost" href={profile ? "/units" : "/courses"}>
              {profile ? "Browse the units" : "See the course"}
            </Link>
          </div>
          <div className="stats">
            <div><b>10</b><span>activities</span></div>
            <div><b>5</b><span>rubric criteria</span></div>
            <div><b>20</b><span>marks</span></div>
            {student && done > 0 && <div><b>{done}/10</b><span>you have done</span></div>}
          </div>
        </section>
      )}

      {!profile && (
        <div className="note" style={{ marginBottom: 12 }}>
          <b>New here?</b> Joining is by link only. Open the class link your teacher shared in the announcement or
          WhatsApp group, then add your name, email and a password.
        </div>
      )}

      {waiting > 0 && (
        <Link className="card" href="/shared" style={{ display: "block", textDecoration: "none", borderLeft: "4px solid var(--gold)" }}>
          <div className="spread">
            <h3>Classmates are waiting for your feedback</h3>
            <span className="pill c5">{waiting}</span>
          </div>
          <p className="small muted">Open Shared with me to listen and score their recordings.</p>
        </Link>
      )}

      <div className="grid">
        <div className="card">
          <h3>Record with a timer</h3>
          <p className="small muted">
            Every activity has a prep clock and a speaking target. The timer turns red when you run over, so timing
            stops being a surprise on the day.
          </p>
        </div>
        <div className="card">
          <h3>Peer review that counts</h3>
          <p className="small muted">
            Your classmate scores the same five criteria your teacher will use, with the band descriptors in front of
            them as they listen.
          </p>
        </div>
        <div className="card">
          <h3>A second opinion</h3>
          <p className="small muted">
            AI reads your transcript and timing and scores the same rubric, building on your classmate&rsquo;s
            feedback. Your teacher gives the official mark.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>How a round works</h3>
        <div style={{ marginTop: 12 }}>
          {[
            ["Pick an activity and prepare", "Plan a framework, not a script — reading aloud costs marks under criterion 3."],
            ["Record and check your timing", "You get your length, your pace in words per minute, and a filler-word count. Two attempts per activity."],
            ["Share it with a classmate", "One tap on their name. Their scores and comments appear on your recording."],
            ["Then ask the AI", "It builds on what your classmate said rather than replacing them."],
          ].map(([t, d], i) => (
            <div className="step" key={t}>
              <span className="k">{i + 1}</span>
              <div>
                <b className="small">{t}</b>
                <p className="small muted" style={{ margin: "2px 0 0" }}>{d}</p>
              </div>
            </div>
          ))}
        </div>
        {student && (
          <Link className="btn block gold" style={{ marginTop: 14 }} href="/activities">
            {done ? "Choose your next activity" : "Choose your first activity"}
          </Link>
        )}
      </div>

      <div className="card">
        <div className="spread">
          <h3>The rubric, in short</h3>
          <span className="total">/20</span>
        </div>
        <div style={{ marginTop: 8 }}>
          {RUBRIC.map((c) => (
            <div className="score-row" key={c.id}>
              <span className="nm">{c.n}. {c.name}</span>
              <span className={`pill c${c.n}`}>4 marks</span>
            </div>
          ))}
        </div>
        <Link className="btn ghost sm block" style={{ marginTop: 10 }} href="/rubric">
          Read the full descriptors
        </Link>
      </div>
    </>
  );
}
