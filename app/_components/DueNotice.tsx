import Link from "next/link";
import Icon from "./Icon";
import { dueState, dueDayWord, fmtDueDay, fmtDueTime, relDue, TZ_LABEL } from "@/app/_lib/due";

export type DueItem = {
  lessonId: string;
  title: string;
  href: string;
  dueAt: string;
  note: string | null;
  /** one-event calendar file; null in the staff preview */
  calHref: string | null;
};

/**
 * The deadline notification on the student Home page: the nearest activity
 * with a deadline that the student has not recorded yet, the next two after
 * it, and any that are already overdue. Nothing shows when no deadline is
 * waiting. Indigo = upcoming, amber = within two days, red = overdue.
 */
export default function DueNotice({ upcoming, overdue, sample }: { upcoming: DueItem[]; overdue: DueItem[]; sample?: boolean }) {
  const main = upcoming[0] ?? overdue[0];
  if (!main) return null;

  const isOverdue = !upcoming.length;
  const tone = isOverdue ? "overdue" : dueState(main.dueAt);
  const kicker = isOverdue
    ? `Overdue · was due ${relDue(main.dueAt)}`
    : `${tone === "soon" ? "Deadline soon" : "Upcoming deadline"} · ${relDue(main.dueAt)}`;

  const more = upcoming.slice(1, 3);
  const extra = upcoming.length - 1 - more.length;
  const lateOnes = isOverdue ? overdue.slice(1) : overdue;

  return (
    <section className={`due-notice ${tone}`} aria-label="Deadline notification">
      <div className="dn-ico">
        <Icon name="bell" size={22} />
      </div>

      <div className="dn-body">
        <div className="dn-kicker">
          {kicker}
          {sample && <span className="dn-sample">sample</span>}
        </div>
        <h3>{main.title}</h3>
        <p>
          <b>
            {isOverdue ? `Was due ${fmtDueDay(main.dueAt)}` : dueDayWord(main.dueAt)}, {fmtDueTime(main.dueAt)}
          </b>{" "}
          <span className="tiny muted">· {TZ_LABEL}</span>
        </p>
        {main.note && <p className="dn-note">{main.note}</p>}
        {isOverdue && <p className="dn-note">You can still record it. Your teacher will see the attempt marked Late.</p>}

        {more.length > 0 && (
          <p className="dn-more">
            Also coming up:{" "}
            {more.map((m, i) => (
              <span key={m.lessonId}>
                {i > 0 && "; "}
                <Link href={m.href}>{m.title}</Link> · {fmtDueDay(m.dueAt)}
              </span>
            ))}
            {extra > 0 && (
              <>
                {" "}
                and <Link href="/activities">{extra} more</Link>
              </>
            )}
          </p>
        )}

        {lateOnes.length > 0 && (
          <p className="dn-late">
            <b>{isOverdue ? "Also overdue" : "Overdue"}:</b>{" "}
            {lateOnes.slice(0, 2).map((m, i) => (
              <span key={m.lessonId}>
                {i > 0 && "; "}
                <Link href={m.href}>{m.title}</Link> (was due {fmtDueDay(m.dueAt)})
              </span>
            ))}
            {lateOnes.length > 2 && (
              <>
                {" "}
                and <Link href="/activities">{lateOnes.length - 2} more</Link>
              </>
            )}
            {!isOverdue &&
              (lateOnes.length === 1
                ? ". You can still record it; it will be marked Late."
                : ". You can still record them; they will be marked Late.")}
          </p>
        )}
      </div>

      <div className="dn-actions">
        <Link className="btn sm" href={main.href}>
          <Icon name="mic" size={16} /> {isOverdue ? "Record it now" : "Start recording"}
        </Link>
        {main.calHref ? (
          <a className="btn sm act k-calendar" href={main.calHref} title="Opens in Apple Calendar, Google Calendar, Outlook or any calendar app">
            <Icon name="calendar" size={16} /> Add to calendar
          </a>
        ) : (
          <span className="btn sm act k-calendar" aria-disabled="true" title="Students download their own calendar file">
            <Icon name="calendar" size={16} /> Add to calendar
          </span>
        )}
      </div>
    </section>
  );
}
