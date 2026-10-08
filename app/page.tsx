import Link from "next/link";
import { currentProfile, homeFor } from "@/app/_lib/supabase";
import { RUBRIC } from "@/app/_lib/rubric";
import { firstName } from "@/app/_lib/format";

export default async function Home() {
  let profile = null;
  try {
    profile = await currentProfile();
  } catch {}

  const student = profile?.role === "student";

  return (
    <>
      {profile ? (
        <section className="hero">
          <h2>Welcome back, {firstName(profile.full_name)}.</h2>
          <p>
            {student
              ? "Pick a speaking task, record it against the clock, then share it with a classmate for feedback against the rubric."
              : "Your classes, their join links and every student recording are under My classes."}
          </p>
          <div className="row">
            <Link className="btn gold" href={homeFor(profile.role)}>
              {student ? "Continue learning" : "Open my classes"}
            </Link>
            <Link className="btn ghost" href={student ? "/shared" : "/courses"}>
              {student ? "Shared with me" : "The course"}
            </Link>
          </div>
          <div className="stats">
            <div><b>10</b><span>speaking tasks</span></div>
            <div><b>2</b><span>attempts each</span></div>
            <div><b>20</b><span>marks</span></div>
          </div>
        </section>
      ) : (
        <>
          <section className="hero">
            <h1>Practise your presentation until it sounds right.</h1>
            <p>
              Short lessons and ten timed speaking tasks. Record yourself, share the recording with a
              classmate for feedback against the rubric, then get a second reading from AI.
            </p>
            <div className="row">
              <Link className="btn gold" href="/login">Sign in</Link>
              <Link className="btn ghost" href="/courses">See the course</Link>
            </div>
            <div className="stats">
              <div><b>10</b><span>speaking tasks</span></div>
              <div><b>5</b><span>rubric criteria</span></div>
              <div><b>20</b><span>marks</span></div>
            </div>
          </section>
          <div className="note" style={{ marginBottom: 12 }}>
            <b>New here?</b> Joining is by link only. Open the class link your teacher shared in the
            announcement or WhatsApp group, then add your name, email and a password.
          </div>
        </>
      )}

      <div className="grid">
        <div className="card">
          <h3>Record with a timer</h3>
          <p className="small muted">
            A preparation clock, a three-second count-in, then a countdown of your speaking time that turns
            red when you run over.
          </p>
        </div>
        <div className="card">
          <h3>Two attempts</h3>
          <p className="small muted">
            Save up to two attempts per task. You can delete the first and start again; the second is final.
          </p>
        </div>
        <div className="card">
          <h3>One-tap sharing</h3>
          <p className="small muted">
            Tap Share next to a classmate&rsquo;s name. They listen here and score you on the same rubric your
            teacher uses.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>How a round works</h3>
        <div style={{ marginTop: 12 }}>
          {[
            ["Pick a task and prepare", "Plan a framework, not a script. Reading aloud costs marks under criterion 3."],
            ["Record against the clock", "You see your length, your pace in words per minute, and a filler-word count."],
            ["Share with a classmate", "One tap. Their scores and comments appear on your recording."],
            ["Then ask the AI", "It builds on your classmate's feedback rather than replacing it. Your teacher gives the mark."],
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
