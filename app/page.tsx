import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Learn to present, one skill at a time.</h1>
        <p>
          Short lessons, timed practice, and feedback against the same rubric your teacher marks
          with. Record yourself, send it to a classmate, and see exactly where the marks are.
        </p>
        <div className="row">
          <Link className="btn gold" href="/courses">
            Browse courses
          </Link>
          <Link className="btn ghost" href="/login">
            Sign in
          </Link>
        </div>
      </section>

      <div className="grid">
        <div className="card">
          <h3>Watch, read, then do</h3>
          <p className="small muted">
            Each unit mixes short video and audio with a task you complete yourself — not a wall of
            slides.
          </p>
        </div>
        <div className="card">
          <h3>Practice that is timed</h3>
          <p className="small muted">
            Every speaking task has a preparation clock and a target length, so timing stops being a
            surprise on the day.
          </p>
        </div>
        <div className="card">
          <h3>Feedback that counts</h3>
          <p className="small muted">
            A classmate scores you on the five rubric criteria, AI adds a second reading, and your
            teacher gives the mark.
          </p>
        </div>
      </div>
    </>
  );
}
