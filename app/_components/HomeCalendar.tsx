"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { unitMeta } from "@/app/_lib/activities";
import { TZ_LABEL, dueState, fmtDueDay, fmtDueTime, relDue, riyadhParts } from "@/app/_lib/due";

/**
 * The calendar on the Home page: a month of deadlines, each on its day in its
 * unit's colour. Tap a day to list what is due that day; below the month, the
 * next deadlines are listed. Students see their class's deadlines (ticked once
 * recorded), teachers their classes', administrators every class's.
 * All days are Riyadh days.
 */

export type CalItem = {
  key: string;
  title: string;
  dueAt: string;
  href: string;
  unit: number;
  /** recorded already (students), shown ticked */
  done?: boolean;
  /** which classes, for staff: "Section 101, 102" */
  where?: string;
  note?: string | null;
};

type YMD = { y: number; m: number; d: number };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const keyOf = (a: YMD) => `${a.y}-${a.m}-${a.d}`;
const same = (a: YMD | null, b: YMD | null) => !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;
const addDays = (a: YMD, n: number): YMD => {
  const t = new Date(Date.UTC(a.y, a.m, a.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
};
const ymdOf = (iso: string): YMD => {
  const p = riyadhParts(new Date(iso));
  return { y: p.y, m: p.m, d: p.d };
};
function monthDays(y: number, m: number): YMD[] {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
  return Array.from({ length: 42 }, (_, i) => addDays({ y, m, d: 1 }, i - first));
}

function stateOf(it: CalItem): "done" | "upcoming" | "soon" | "past" {
  return it.done ? "done" : dueState(it.dueAt);
}

const STATE_LABEL = { done: "Recorded", upcoming: "Upcoming", soon: "Due soon", past: "Overdue" } as const;

function Row({ it, staff }: { it: CalItem; staff?: boolean }) {
  const st = stateOf(it);
  return (
    <li className={`hc-row ${st}`} style={{ ["--unit" as any]: unitMeta(it.unit).colour }}>
      <span className="hc-date" suppressHydrationWarning>
        <b>{fmtDueDay(it.dueAt)}</b>
        <i>{fmtDueTime(it.dueAt)}</i>
      </span>
      <span className="hc-what">
        <Link href={it.href}>{it.title}</Link>
        <span className="tiny muted" suppressHydrationWarning>
          {" "}· Unit {it.unit}
          {it.where ? ` · ${it.where}` : ""}
          {st !== "done" ? ` · ${relDue(it.dueAt)}` : ""}
        </span>
        {it.note && <span className="hc-note">{it.note}</span>}
      </span>
      <span className={`hc-pill ${st}`}>
        {st === "done" ? "✓ " : ""}
        {staff && st === "past" ? "Passed" : STATE_LABEL[st]}
      </span>
    </li>
  );
}

export default function HomeCalendar({
  items,
  icsHref,
  sample,
  staff,
  emptyText,
}: {
  items: CalItem[];
  /** "Add all to calendar" (.ics); null hides it (student preview) */
  icsHref: string | null;
  sample?: boolean;
  /** teachers and administrators: past deadlines are "Passed", not "Overdue" */
  staff?: boolean;
  emptyText: string;
}) {
  const now = riyadhParts(new Date());
  const today: YMD = { y: now.y, m: now.m, d: now.d };
  const [view, setView] = useState({ y: today.y, m: today.m });
  const [picked, setPicked] = useState<YMD | null>(null);

  const sorted = useMemo(() => [...items].sort((a, b) => a.dueAt.localeCompare(b.dueAt)), [items]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of sorted) {
      const k = keyOf(ymdOf(it.dueAt));
      map.set(k, [...(map.get(k) ?? []), it]);
    }
    return map;
  }, [sorted]);

  const move = (n: number) => {
    const t = new Date(Date.UTC(view.y, view.m + n, 1));
    setView({ y: t.getUTCFullYear(), m: t.getUTCMonth() });
  };

  const nowMs = Date.now();
  const coming = sorted.filter((it) => !it.done && new Date(it.dueAt).getTime() >= nowMs);
  const overdue = staff ? [] : sorted.filter((it) => !it.done && new Date(it.dueAt).getTime() < nowMs);
  const dayList = picked ? byDay.get(keyOf(picked)) ?? [] : null;

  return (
    <section className={`hc card${staff ? " staff" : ""}`} aria-label="Calendar">
      <div className="hc-head">
        <span className="hc-ico">
          <Icon name="calendar" size={20} />
        </span>
        <h3>Calendar</h3>
        {sample && <span className="dn-sample">sample</span>}
        {icsHref && items.length > 0 && (
          <a className="btn sm act k-calendar" href={icsHref} title="Opens in Apple Calendar, Google Calendar, Outlook or any calendar app">
            <Icon name="calendar" size={16} /> Add all to my calendar
          </a>
        )}
      </div>

      <div className="hc-month">
        <div className="cal-head">
          <button type="button" className="cal-nav" onClick={() => move(-1)} aria-label="Previous month">‹</button>
          <b>{MONTHS[view.m]} {view.y}</b>
          <button type="button" className="cal-nav" onClick={() => move(1)} aria-label="Next month">›</button>
          <button
            type="button"
            className="cal-today"
            onClick={() => {
              setView({ y: today.y, m: today.m });
              setPicked(null);
            }}
          >
            Today
          </button>
        </div>
        <div className="calv-grid">
          {DOW.map((d) => (
            <span key={d} className={`cal-dow${d === "Fri" || d === "Sat" ? " wk" : ""}`}>{d}</span>
          ))}
          {monthDays(view.y, view.m).map((day, i) => {
            const list = byDay.get(keyOf(day)) ?? [];
            const cls = [
              "calv-day",
              "hc-day",
              day.m !== view.m && "other",
              same(day, today) && "today",
              same(day, picked) && "picked",
              (i % 7 === 5 || i % 7 === 6) && "wk",
              list.length > 0 && "has",
            ]
              .filter(Boolean)
              .join(" ");
            const label = `${DOW[i % 7]} ${day.d} ${MONTHS[day.m]}${list.length ? `, ${list.length} deadline${list.length === 1 ? "" : "s"}` : ""}`;
            const inner = (
              <>
                <span className="n">{day.d}</span>
                {list.slice(0, 3).map((it) => (
                  <span
                    key={it.key}
                    className={`calv-ev ${stateOf(it)}`}
                    style={{ ["--unit" as any]: unitMeta(it.unit).colour }}
                    title={`${it.title} · ${fmtDueTime(it.dueAt)}`}
                  >
                    {it.done ? "✓ " : <i>{fmtDueTime(it.dueAt)} </i>}
                    {it.title}
                  </span>
                ))}
                {list.length > 3 && <span className="hc-moreday">+{list.length - 3} more</span>}
              </>
            );
            return list.length ? (
              <button
                key={keyOf(day)}
                type="button"
                className={cls}
                aria-label={label}
                aria-pressed={same(day, picked)}
                onClick={() => setPicked(same(day, picked) ? null : day)}
              >
                {inner}
              </button>
            ) : (
              <div key={keyOf(day)} className={cls} aria-label={label}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      {dayList ? (
        <div className="hc-list">
          <div className="hc-list-hd">
            <b>
              {DOW[new Date(Date.UTC(picked!.y, picked!.m, picked!.d)).getUTCDay()]} {picked!.d} {MONTHS[picked!.m]}
            </b>
            <button type="button" className="sv-x" onClick={() => setPicked(null)}>Show what is coming up</button>
          </div>
          <ul>
            {dayList.map((it) => (
              <Row key={it.key} it={it} staff={staff} />
            ))}
          </ul>
        </div>
      ) : items.length === 0 ? (
        <p className="small muted hc-empty">{emptyText}</p>
      ) : (
        <div className="hc-list">
          {overdue.length > 0 && (
            <>
              <div className="hc-list-hd"><b>Overdue</b></div>
              <ul>
                {overdue.slice(0, 3).map((it) => (
                  <Row key={it.key} it={it} staff={staff} />
                ))}
              </ul>
            </>
          )}
          <div className="hc-list-hd">
            <b>Coming up</b>
            <span className="tiny muted">Tap a day to see its deadlines · {TZ_LABEL}</span>
          </div>
          {coming.length ? (
            <ul>
              {coming.slice(0, 4).map((it) => (
                <Row key={it.key} it={it} staff={staff} />
              ))}
            </ul>
          ) : (
            <p className="small muted" style={{ margin: "4px 0 0" }}>
              {staff ? "No deadlines coming up." : "Nothing else is due. Well done."}
            </p>
          )}
          {coming.length > 4 && <p className="tiny muted" style={{ margin: "6px 0 0" }}>and {coming.length - 4} more later on.</p>}
        </div>
      )}
    </section>
  );
}
