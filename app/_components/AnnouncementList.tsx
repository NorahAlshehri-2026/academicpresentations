import { linkParts, type AnnouncementShown } from "@/app/_lib/announcement-types";
import { fmtDue, fmtDueDay } from "@/app/_lib/due";

/** A message with its line breaks kept and its web links tappable. */
export function AnnouncementText({ text }: { text: string }) {
  return (
    <p className="an-body">
      {linkParts(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </p>
  );
}

function Megaphone({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function AnnouncementItem({ a, staffView, children }: { a: AnnouncementShown; staffView?: boolean; children?: React.ReactNode }) {
  return (
    <article className={`an-item${a.ended ? " ended" : ""}`}>
      <div className="an-top">
        <h4>{a.title}</h4>
        {a.isNew && !a.ended && <span className="an-new">New</span>}
        {staffView && a.ended && <span className="pill c0">Ended</span>}
      </div>
      <div className="an-meta" suppressHydrationWarning>
        {a.by}
        {" · "}
        {fmtDue(a.posted)}
        {a.edited ? " · edited" : ""}
        {staffView && (
          <>
            {" · "}
            <b>To: {a.to}</b>
            {" · "}
            {a.until ? `${a.ended ? "Ended" : "Shows until"} ${fmtDueDay(a.until)}` : "Shows until removed"}
          </>
        )}
      </div>
      <AnnouncementText text={a.body} />
      {children}
    </article>
  );
}

/**
 * Announcements at the top of a student's Home page: the newest three, and
 * the rest behind "Show more". Nothing shows when there are none.
 */
export default function AnnouncementList({ items, sample }: { items: AnnouncementShown[]; sample?: boolean }) {
  if (!items.length) return null;
  const first = items.slice(0, 3);
  const rest = items.slice(3);
  const fresh = items.filter((a) => a.isNew).length;
  return (
    <section className="an-panel" aria-label="Announcements">
      <div className="an-head">
        <span className="an-ico">
          <Megaphone />
        </span>
        <h3>Announcements</h3>
        {fresh > 0 && <span className="an-count">{fresh} new</span>}
        {sample && <span className="dn-sample">sample</span>}
      </div>
      {first.map((a) => (
        <AnnouncementItem key={a.id} a={a} />
      ))}
      {rest.length > 0 && (
        <details className="an-more">
          <summary>
            Show {rest.length} earlier announcement{rest.length === 1 ? "" : "s"}
          </summary>
          {rest.map((a) => (
            <AnnouncementItem key={a.id} a={a} />
          ))}
        </details>
      )}
    </section>
  );
}

export { Megaphone };
