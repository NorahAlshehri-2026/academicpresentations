"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";
import { unitMeta } from "@/app/_lib/activities";
import {
  TZ_LABEL,
  dueState,
  fmtDue,
  fmtDueTime,
  fromRiyadh,
  relDue,
  riyadhParts,
  type Deadline,
} from "@/app/_lib/due";

/**
 * Deadlines for one class: optional, one per speaking activity.
 *
 * At the top, a month calendar shows every deadline of the class on its day,
 * in its unit's colour. Below, each activity has "No deadline" or a date and
 * time chosen on a calendar picker (Riyadh time). Students see the same
 * deadlines on their pages, and anyone can add them to their own calendar
 * with the .ics buttons. Recording after a deadline is still allowed; it is
 * shown as Late.
 */

type Task = { id: string; title: string; unit: number };
type YMD = { y: number; m: number; d: number };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// times in 30-minute steps from 6:00 am, and 11:59 pm last
const TIMES: { h: number; min: number; label: string }[] = (() => {
  const out: { h: number; min: number; label: string }[] = [];
  for (let h = 6; h <= 23; h++)
    for (const min of [0, 30]) {
      const hh = h % 12 === 0 ? 12 : h % 12;
      out.push({ h, min, label: `${hh}:${String(min).padStart(2, "0")} ${h < 12 ? "am" : "pm"}` });
    }
  out.push({ h: 23, min: 59, label: "11:59 pm (end of day)" });
  return out;
})();

const same = (a: YMD | null, b: YMD | null) => !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;
const key = (a: YMD) => `${a.y}-${a.m}-${a.d}`;
const addDays = (a: YMD, n: number): YMD => {
  const t = new Date(Date.UTC(a.y, a.m, a.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
};
const before = (a: YMD, b: YMD) => a.y !== b.y ? a.y < b.y : a.m !== b.m ? a.m < b.m : a.d < b.d;
const ymdOf = (iso: string): YMD => {
  const p = riyadhParts(new Date(iso));
  return { y: p.y, m: p.m, d: p.d };
};

/** The 6 x 7 days shown for a month, starting on Sunday. */
function monthDays(y: number, m: number): YMD[] {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
  return Array.from({ length: 42 }, (_, i) => addDays({ y, m, d: 1 }, i - first));
}

function MonthNav({ y, m, onMove, onToday }: { y: number; m: number; onMove: (n: number) => void; onToday: () => void }) {
  return (
    <div className="cal-head">
      <button type="button" className="cal-nav" onClick={() => onMove(-1)} aria-label="Previous month">‹</button>
      <b>{MONTHS[m]} {y}</b>
      <button type="button" className="cal-nav" onClick={() => onMove(1)} aria-label="Next month">›</button>
      <button type="button" className="cal-today" onClick={onToday}>Today</button>
    </div>
  );
}

/** The date picker: today ringed, the chosen day filled, past days unavailable, days with other deadlines dotted. */
function CalendarPicker({ value, onPick, busyDays }: { value: YMD | null; onPick: (d: YMD) => void; busyDays: Set<string> }) {
  const now = riyadhParts(new Date());
  const today: YMD = { y: now.y, m: now.m, d: now.d };
  const start = value ?? today;
  const [view, setView] = useState({ y: start.y, m: start.m });
  const move = (n: number) => {
    const t = new Date(Date.UTC(view.y, view.m + n, 1));
    setView({ y: t.getUTCFullYear(), m: t.getUTCMonth() });
  };
  return (
    <div className="cal" role="group" aria-label="Choose a date">
      <MonthNav y={view.y} m={view.m} onMove={move} onToday={() => setView({ y: today.y, m: today.m })} />
      <div className="cal-grid">
        {DOW.map((d) => (
          <span key={d} className={`cal-dow${d === "Fri" || d === "Sat" ? " wk" : ""}`}>{d}</span>
        ))}
        {monthDays(view.y, view.m).map((day, i) => {
          const past = before(day, today);
          const cls = [
            "cal-day",
            day.m !== view.m && "other",
            same(day, today) && "today",
            same(day, value) && "sel",
            (i % 7 === 5 || i % 7 === 6) && "wk",
            busyDays.has(key(day)) && "busy",
          ].filter(Boolean).join(" ");
          return (
            <button
              key={key(day)}
              type="button"
              className={cls}
              disabled={past}
              aria-pressed={same(day, value)}
              aria-label={`${DOW[i % 7]} ${day.d} ${MONTHS[day.m]} ${day.y}${busyDays.has(key(day)) ? ", has a deadline" : ""}`}
              onClick={() => onPick(day)}
            >
              {day.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The class's deadlines on a month calendar. */
function ClassCalendar({
  tasks,
  deadlines,
  onOpen,
}: {
  tasks: Task[];
  deadlines: Deadline[];
  onOpen: (lessonId: string) => void;
}) {
  const now = riyadhParts(new Date());
  const today: YMD = { y: now.y, m: now.m, d: now.d };
  const firstDue = [...deadlines].sort((a, b) => a.due_at.localeCompare(b.due_at)).find((d) => dueState(d.due_at) !== "past");
  const start = firstDue ? ymdOf(firstDue.due_at) : today;
  const [view, setView] = useState({ y: start.y, m: start.m });
  const move = (n: number) => {
    const t = new Date(Date.UTC(view.y, view.m + n, 1));
    setView({ y: t.getUTCFullYear(), m: t.getUTCMonth() });
  };
  const byDay = new Map<string, Deadline[]>();
  for (const d of deadlines) {
    const k = key(ymdOf(d.due_at));
    byDay.set(k, [...(byDay.get(k) ?? []), d]);
  }
  return (
    <div className="calv">
      <MonthNav y={view.y} m={view.m} onMove={move} onToday={() => setView({ y: today.y, m: today.m })} />
      <div className="calv-grid">
        {DOW.map((d) => (
          <span key={d} className={`cal-dow${d === "Fri" || d === "Sat" ? " wk" : ""}`}>{d}</span>
        ))}
        {monthDays(view.y, view.m).map((day, i) => {
          const items = (byDay.get(key(day)) ?? []).sort((a, b) => a.due_at.localeCompare(b.due_at));
          return (
            <div
              key={key(day)}
              className={["calv-day", day.m !== view.m && "other", same(day, today) && "today", (i % 7 === 5 || i % 7 === 6) && "wk"].filter(Boolean).join(" ")}
            >
              <span className="n">{day.d}</span>
              {items.map((d) => {
                const t = tasks.find((x) => x.id === d.lesson_id);
                if (!t) return null;
                return (
                  <button
                    key={d.lesson_id}
                    type="button"
                    className={`calv-ev ${dueState(d.due_at)}`}
                    style={{ ["--unit" as any]: unitMeta(t.unit).colour }}
                    title={`${t.title} · due ${fmtDue(d.due_at)}`}
                    onClick={() => onOpen(d.lesson_id)}
                  >
                    <i>{fmtDueTime(d.due_at)}</i> {t.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Choose "No deadline" or a date and time for one activity. */
function DeadlineEditor({
  sectionId,
  task,
  current,
  busyDays,
  onDone,
}: {
  sectionId: string;
  task: Task;
  current: Deadline | null;
  busyDays: Set<string>;
  onDone: () => void;
}) {
  const router = useRouter();
  const initial = current ? riyadhParts(new Date(current.due_at)) : null;
  // a saved time that is not on the list (e.g. set elsewhere) is kept as its own option
  const times = useMemo(() => {
    if (!initial || TIMES.some((t) => t.h === initial.h && t.min === initial.min)) return TIMES;
    const hh = initial.h % 12 === 0 ? 12 : initial.h % 12;
    const extra = { h: initial.h, min: initial.min, label: `${hh}:${String(initial.min).padStart(2, "0")} ${initial.h < 12 ? "am" : "pm"}` };
    return [...TIMES, extra].sort((a, b) => a.h * 60 + a.min - (b.h * 60 + b.min));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mode, setMode] = useState<"none" | "set">("set");
  const [date, setDate] = useState<YMD | null>(initial ? { y: initial.y, m: initial.m, d: initial.d } : null);
  const [time, setTime] = useState<number>(() => {
    if (!initial) return times.length - 1;
    const i = times.findIndex((t) => t.h === initial.h && t.min === initial.min);
    return i === -1 ? times.length - 1 : i;
  });
  const [note, setNote] = useState(current?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = riyadhParts(new Date());
  const today: YMD = { y: now.y, m: now.m, d: now.d };
  const daysToThu = (4 - now.dow + 7) % 7 || 7;
  const presets: [string, YMD][] = [
    ["Tomorrow", addDays(today, 1)],
    ["In 3 days", addDays(today, 3)],
    ["Next Thursday", addDays(today, daysToThu)],
    ["In 1 week", addDays(today, 7)],
    ["In 2 weeks", addDays(today, 14)],
  ];

  const dueIso = date ? fromRiyadh(date.y, date.m, date.d, times[time].h, times[time].min).toISOString() : null;
  const others = new Set(Array.from(busyDays).filter((k) => !current || k !== key(ymdOf(current.due_at))));

  async function save() {
    setError(null);
    const supabase = browserClient();
    setBusy(true);
    if (mode === "none") {
      if (current) {
        const { error: e } = await supabase.from("deadlines").delete().eq("section_id", sectionId).eq("lesson_id", task.id);
        if (e) {
          setBusy(false);
          return setError(e.message);
        }
      }
    } else {
      if (!dueIso) {
        setBusy(false);
        return setError("Choose a date on the calendar.");
      }
      if (new Date(dueIso).getTime() < Date.now()) {
        setBusy(false);
        return setError("That time has already passed. Choose a later date or time.");
      }
      const { error: e } = await supabase
        .from("deadlines")
        .upsert(
          { section_id: sectionId, lesson_id: task.id, due_at: dueIso, note: note.trim() || null },
          { onConflict: "section_id,lesson_id" }
        );
      if (e) {
        setBusy(false);
        return setError(e.message);
      }
    }
    setBusy(false);
    onDone();
    router.refresh();
  }

  return (
    <div className="dl-editor">
      <div className="dl-toggle" role="group" aria-label="Deadline">
        <button type="button" aria-pressed={mode === "none"} onClick={() => setMode("none")}>No deadline</button>
        <button type="button" aria-pressed={mode === "set"} onClick={() => setMode("set")}>Set a deadline</button>
      </div>

      {mode === "none" ? (
        <p className="small muted" style={{ marginTop: 10 }}>
          Students can record this activity at any time. Nothing is ever marked Late.
        </p>
      ) : (
        <div className="dl-pick">
          <CalendarPicker value={date} onPick={setDate} busyDays={others} />
          <div className="dl-side">
            <label className="fld" htmlFor={`dt-${task.id}`} style={{ marginTop: 0 }}>Time</label>
            <select id={`dt-${task.id}`} value={time} onChange={(e) => setTime(Number(e.target.value))}>
              {times.map((t, i) => (
                <option key={i} value={i}>{t.label}</option>
              ))}
            </select>

            <label className="fld" style={{ marginTop: 12 }}>Quick dates</label>
            <div className="row" style={{ gap: 6 }}>
              {presets.map(([label, d]) => (
                <button key={label} type="button" className={`chip${same(d, date) ? " on" : ""}`} onClick={() => setDate(d)}>
                  {label}
                </button>
              ))}
            </div>

            <label className="fld" htmlFor={`dn-${task.id}`}>Note for students (optional)</label>
            <input
              id={`dn-${task.id}`}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Record in a quiet room"
            />

            <div className={`dl-summary${dueIso ? "" : " empty"}`}>
              {dueIso ? (
                <>
                  <b>Due {fmtDue(dueIso)}</b>
                  <span className="tiny muted">{TZ_LABEL} · {relDue(dueIso)}</span>
                </>
              ) : (
                <span className="small muted">Pick a day on the calendar.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <button type="button" className="btn sm act k-deadline" onClick={save} disabled={busy}>
          {busy ? "Saving…" : mode === "none" ? (current ? "Remove the deadline" : "Save: no deadline") : "Save deadline"}
        </button>
        <button type="button" className="btn ghost sm" onClick={onDone} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

export default function DeadlinesPanel({
  sectionId,
  tasks,
  deadlines,
  canEdit,
  missing,
}: {
  sectionId: string;
  tasks: Task[];
  deadlines: Deadline[];
  canEdit: boolean;
  missing: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const units = Array.from(new Set(tasks.map((t) => t.unit))).sort((a, b) => a - b);
  const busyDays = useMemo(() => new Set(deadlines.map((d) => key(ymdOf(d.due_at)))), [deadlines]);
  const dueOf = (id: string) => deadlines.find((d) => d.lesson_id === id) ?? null;

  const open = (id: string) => {
    if (!canEdit) return;
    setEditing(id);
    setTimeout(() => document.getElementById(`dl-row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  if (missing) {
    return (
      <div className="note" style={{ marginTop: 10 }}>
        Deadlines are not switched on yet. Run <b>DEADLINES-2026-10.sql</b> once in Supabase → SQL Editor, then reload
        this page.
      </div>
    );
  }

  return (
    <>
      <ClassCalendar tasks={tasks} deadlines={deadlines} onOpen={open} />

      <div className="dl-list">
        {units.map((u) => (
          <div key={u} className="dl-unit" style={{ ["--unit" as any]: unitMeta(u).colour }}>
            <div className="dl-unit-hd">Unit {u} · {unitMeta(u).title}</div>
            {tasks
              .filter((t) => t.unit === u)
              .map((t) => {
                const d = dueOf(t.id);
                const st = d ? dueState(d.due_at) : null;
                return (
                  <div key={t.id} id={`dl-row-${t.id}`} className={`dl-row${editing === t.id ? " open" : ""}`}>
                    <div className="dl-line">
                      <span className="dl-title">{t.title}</span>
                      {d ? (
                        <span className={`dl-pill ${st}`} title={d.note ?? undefined}>
                          Due {fmtDue(d.due_at)} <i suppressHydrationWarning>· {st === "past" ? `passed ${relDue(d.due_at).replace(" ago", "")} ago` : relDue(d.due_at)}</i>
                        </span>
                      ) : (
                        <span className="dl-pill none">No deadline</span>
                      )}
                      <span className="dl-actions">
                        {d && (
                          <a className="btn sm act k-calendar" href={`/calendar?section=${sectionId}&lesson=${t.id}`} title="Add to Apple Calendar, Google Calendar, Outlook or any calendar app">
                            .ics
                          </a>
                        )}
                        {canEdit && editing !== t.id && (
                          <button type="button" className="btn sm act k-deadline" onClick={() => setEditing(t.id)}>
                            {d ? "Change" : "Set deadline"}
                          </button>
                        )}
                      </span>
                    </div>
                    {editing === t.id && (
                      <DeadlineEditor
                        sectionId={sectionId}
                        task={t}
                        current={d}
                        busyDays={busyDays}
                        onDone={() => setEditing(null)}
                      />
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </>
  );
}
