import Link from "next/link";
import { GAMES } from "./_games";

export const metadata = { title: "Advanced Reading and Writing" };

export default function ReadingWriting() {
  return (
    <>
      <div className="card">
        <h3>Advanced Reading and Writing</h3>
        <p className="small muted" style={{ marginTop: 6 }}>
          Interactive activities for this course. More units will be added here.
        </p>
      </div>
      <div className="grid">
        {GAMES.map((g) => (
          <Link className="card" key={g.slug} href={`/reading-writing/${g.slug}`} style={{ textDecoration: "none" }}>
            <h3>{g.title}</h3>
            <p className="small muted">{g.summary}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
