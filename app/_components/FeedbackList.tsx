import { RUBRIC, band } from "@/app/_lib/rubric";
import { fmtDate } from "@/app/_lib/format";

export type FeedbackRow = {
  id: string;
  source: "peer" | "teacher" | "ai";
  author_id: string | null;
  scores: Record<string, number> | null;
  strengths: string | null;
  improve: string | null;
  created_at: string;
  author?: { full_name: string } | null;
};

export type MarkRow = {
  total: number;
  per_criterion: Record<string, number> | null;
  comment: string | null;
  created_at: string;
} | null;

const LABEL = { peer: "Classmate", teacher: "Teacher", ai: "AI" } as const;
const CLS = { peer: "c4", teacher: "c1", ai: "c3" } as const;

/** The official mark (if any) and every piece of feedback on one recording. */
export default function FeedbackList({
  feedback,
  mark,
  viewerId,
  emptyText,
}: {
  feedback: FeedbackRow[];
  mark?: MarkRow;
  viewerId: string;
  emptyText: string;
}) {
  const list = [...feedback].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <>
      {mark && (
        <div className="ok" style={{ marginTop: 10 }}>
          <div className="spread">
            <b>Official mark</b>
            <span>
              <b style={{ fontSize: 18 }}>{mark.total}</b>/20{" "}
              <span className="band" style={{ color: band(mark.total)[1], marginLeft: 6 }}>{band(mark.total)[0]}</span>
            </span>
          </div>
          {mark.comment && <p className="small" style={{ margin: "6px 0 0" }}>{mark.comment}</p>}
          <p className="tiny muted" style={{ margin: "4px 0 0" }}>Entered {fmtDate(mark.created_at)}</p>
        </div>
      )}

      {list.length ? (
        list.map((f) => {
          const scored = RUBRIC.filter((c) => f.scores?.[c.id]);
          const sum = scored.reduce((a, c) => a + Number(f.scores![c.id]), 0);
          const who = f.author_id === viewerId ? "You" : f.source === "ai" ? "AI feedback" : f.author?.full_name ?? LABEL[f.source];
          return (
            <div className="fb" key={f.id}>
              <div className="spread">
                <b className="small">
                  {who} <span className={`pill ${CLS[f.source]}`}>{LABEL[f.source]}</span>
                </b>
                {scored.length > 0 && <span className="small muted">{sum}/{scored.length * 4}</span>}
              </div>
              {scored.map((c) => (
                <div className="score-row" key={c.id}>
                  <span className="nm">{c.n}. {c.name}</span>
                  <div className="rbar"><i style={{ width: `${(Number(f.scores![c.id]) / 4) * 100}%` }} /></div>
                  <b className="small">{f.scores![c.id]}</b>
                </div>
              ))}
              {f.strengths && <p className="small" style={{ margin: "6px 0 0" }}><b>What worked:</b> {f.strengths}</p>}
              {f.improve && <p className="small" style={{ margin: "6px 0 0" }}><b>Next time:</b> {f.improve}</p>}
            </div>
          );
        })
      ) : (
        <p className="small muted" style={{ marginTop: 8 }}>{emptyText}</p>
      )}
    </>
  );
}
