import { RUBRIC } from "@/app/_lib/rubric";

export const metadata = { title: "Rubric · Academic Presentations" };

export default function RubricPage() {
  return (
    <>
      <div className="card">
        <div className="spread">
          <h3>Presentation assessment rubric</h3>
          <span className="total">/20</span>
        </div>
        <p className="small muted">
          Five criteria, four marks each. Classmates, teachers and the AI all score against these descriptors.
        </p>
        <div className="row tiny" style={{ marginTop: 8 }}>
          <span className="pill c2">18–20 Excellent</span>
          <span className="pill c1">15–17 Good</span>
          <span className="pill c5">11–14 Satisfactory</span>
          <span className="pill c3">5–10 Needs improvement</span>
        </div>
      </div>
      {RUBRIC.map((c) => (
        <div className="card" key={c.id}>
          <div className="spread">
            <h3>{c.n}. {c.name}</h3>
            <span className={`pill c${c.n}`}>4 marks</span>
          </div>
          <div className="tablewrap" style={{ marginTop: 10 }}>
            <table style={{ minWidth: 560 }}>
              <thead>
                <tr><th>4 Excellent</th><th>3 Good</th><th>2 Developing</th><th>1 Beginning</th></tr>
              </thead>
              <tbody>
                <tr><td>{c.l4}</td><td>{c.l3}</td><td>{c.l2}</td><td>{c.l1}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
