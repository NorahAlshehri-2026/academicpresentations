import Link from "next/link";
import { unitMeta } from "@/app/_lib/activities";
import { ACTIVITY_POINTS, type courseGrade } from "@/app/_lib/scores";

type Grade = ReturnType<typeof courseGrade>;
type Activity = Grade["activities"][number];
type Task = { id: string; title: string; unit: number; course_id?: string };

/**
 * The digital progress tracker: ten activities, 10 points each, 100 in all.
 * Every activity is colour-coded — grey not started, amber recorded and
 * waiting for a mark, green marked (with its points) — and grouped by unit
 * in the unit's own colour.
 *
 *   mode "class":   one row per student (the class gradebook)
 *   mode "student": one student's own tracker (My progress)
 */

const TITLE: Record<Activity["state"], string> = {
  none: "Not started",
  recorded: "Recorded, waiting for a mark",
  marked: "Marked",
};

function label(a: Activity) {
  if (a.state === "marked") return `${TITLE.marked}: ${a.mark}/20 = ${a.points} of ${ACTIVITY_POINTS} points${a.pending ? " (a newer attempt is waiting for a mark)" : ""}`;
  return TITLE[a.state];
}

function Cell({ a, href, wide, title }: { a: Activity; href: string | null; wide?: boolean; title?: string }) {
  const cls = `${wide ? "trk-chip" : "trk"} ${a.state}${a.pending && a.state === "marked" ? " pending" : ""}`;
  const value =
    a.state === "marked" ? (
      <>
        {a.points}
        <small>/{ACTIVITY_POINTS}</small>
      </>
    ) : a.state === "recorded" ? (
      "to mark"
    ) : (
      "—"
    );
  const inner = wide ? (
    <>
      <span>{title}</span>
      <b>{value}</b>
    </>
  ) : (
    value
  );
  return href ? (
    <Link className={cls} href={href} title={label(a)}>
      {inner}
    </Link>
  ) : (
    <span className={cls} title={label(a)}>
      {inner}
    </span>
  );
}

export function Legend() {
  return (
    <div className="trk-legend">
      <span className="trk none">—</span> not started
      <span className="trk recorded">to mark</span> recorded, waiting for a mark
      <span className="trk marked">8<small>/10</small></span> marked: points out of 10
    </div>
  );
}

export function TotalBar({ total }: { total: number }) {
  return (
    <div className="tbar" role="img" aria-label={`${total} out of 100`}>
      <i style={{ width: `${Math.max(0, Math.min(100, total))}%` }} />
    </div>
  );
}

/** The class view: students down the side, activities across, grouped by unit. */
export function ClassTracker({
  tasks,
  rows,
  hrefFor,
}: {
  tasks: Task[];
  rows: { id: string; name: string; href: string; grade: Grade }[];
  hrefFor: (a: Activity) => string | null;
}) {
  const units = Array.from(new Set(tasks.map((t) => t.unit))).sort((a, b) => a - b);
  return (
    <div className="tablewrap" style={{ marginTop: 10 }}>
      <table className="trk-table" style={{ minWidth: 300 + tasks.length * 78 }}>
        <thead>
          <tr>
            <th rowSpan={2}>Student</th>
            {units.map((u) => {
              const n = tasks.filter((t) => t.unit === u).length;
              return (
                <th key={u} colSpan={n} className="trk-unit" style={{ ["--unit" as any]: unitMeta(u).colour }}>
                  Unit {u} · {n * ACTIVITY_POINTS} pts
                </th>
              );
            })}
            <th rowSpan={2} style={{ minWidth: 110 }}>Total /100</th>
          </tr>
          <tr>
            {tasks.map((t) => (
              <th key={t.id} className="trk-act" style={{ ["--unit" as any]: unitMeta(t.unit).colour }}>
                {t.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={r.href}><b>{r.name}</b></Link>
                <div className="tiny muted">{r.grade.done}/{r.grade.of} done · {r.grade.marked} marked</div>
              </td>
              {r.grade.activities.map((a) => (
                <td key={a.taskId}>
                  <Cell a={a} href={hrefFor(a)} />
                </td>
              ))}
              <td className="trk-total">
                <b>{r.grade.total}</b>
                <TotalBar total={r.grade.total} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One student's own tracker, unit by unit. */
export function StudentTracker({ tasks, grade, hrefFor }: { tasks: Task[]; grade: Grade; hrefFor: (a: Activity) => string | null }) {
  return (
    <>
      <div className="trk-big">
        <b>{grade.total}</b>
        <span className="muted">/ 100 points</span>
        <span className="pill" style={{ marginLeft: "auto" }}>
          {grade.done}/{grade.of} done · {grade.marked} marked
        </span>
      </div>
      <TotalBar total={grade.total} />
      <div className="trk-units">
        {grade.units.map((u) => (
          <div key={u.unit} className="trk-unitrow" style={{ ["--unit" as any]: unitMeta(u.unit).colour }}>
            <div className="hd">
              <span>Unit {u.unit} · {unitMeta(u.unit).title}</span>
              <span>{u.points} / {u.max} pts</span>
            </div>
            <div className="acts">
              {grade.activities
                .filter((a) => a.unit === u.unit)
                .map((a) => (
                  <Cell key={a.taskId} a={a} wide href={hrefFor(a)} title={tasks.find((t) => t.id === a.taskId)?.title} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
