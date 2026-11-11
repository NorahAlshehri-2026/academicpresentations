"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BODY_MAX,
  SHOW_FOR,
  TITLE_MAX,
  type AnnouncementShown,
  type SectionChoice,
} from "@/app/_lib/announcement-types";
import { AnnouncementItem, Megaphone } from "./AnnouncementList";

type Draft = { title: string; body: string; all: boolean; sections: string[]; days: number | "same" };

/** The post / edit form. */
function AnnouncementForm({
  sections,
  isAdmin,
  initial,
  editingId,
  onDone,
}: {
  sections: SectionChoice[];
  isAdmin: boolean;
  initial: Draft;
  editingId?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const courses = Array.from(new Set(sections.map((s) => s.course))).filter(Boolean);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const toggle = (id: string) =>
    set({ sections: d.sections.includes(id) ? d.sections.filter((s) => s !== id) : [...d.sections, id] });
  const pick = (ids: string[]) => set({ sections: Array.from(new Set([...d.sections, ...ids])) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!d.title.trim()) return setError("Give the announcement a title.");
    if (!d.body.trim()) return setError("Write the message.");
    if (!d.all && !d.sections.length) return setError("Choose at least one class.");
    setBusy(true);
    try {
      const res = await fetch("/api/announcements", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          title: d.title,
          body: d.body,
          audience: d.all ? "all" : "sections",
          sections: d.all ? [] : d.sections,
          days: d.days,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error || "The announcement could not be saved. Please try again.");
      onDone();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const prefix = editingId ? `an-e-${editingId}` : "an-new";
  return (
    <form className="an-form" onSubmit={submit}>
      <label className="fld" htmlFor={`${prefix}-title`}>Title</label>
      <input
        id={`${prefix}-title`}
        value={d.title}
        maxLength={TITLE_MAX}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="e.g. Activity 3 is due on Thursday"
      />

      <label className="fld" htmlFor={`${prefix}-body`}>Message</label>
      <textarea
        id={`${prefix}-body`}
        rows={4}
        value={d.body}
        maxLength={BODY_MAX}
        onChange={(e) => set({ body: e.target.value })}
        placeholder="Write to your students. Links (https://…) can be tapped."
      />
      <div className="tiny muted" style={{ textAlign: "right" }}>{d.body.length} / {BODY_MAX}</div>

      <div className="fld">Send to</div>
      {isAdmin && (
        <label className="an-check an-all">
          <input type="checkbox" checked={d.all} onChange={(e) => set({ all: e.target.checked })} />
          <span><b>Everyone in the academy</b> <span className="tiny muted">· every student in every class</span></span>
        </label>
      )}
      {!d.all &&
        (sections.length ? (
          <div className="an-classes">
            {courses.map((c) => {
              const list = sections.filter((s) => s.course === c);
              return (
                <div key={c} className="an-course">
                  <div className="an-course-hd">
                    <span>{c}</span>
                    {list.length > 1 && (
                      <button type="button" className="sv-x" onClick={() => pick(list.map((s) => s.id))}>
                        Choose all {list.length}
                      </button>
                    )}
                  </div>
                  {list.map((s) => (
                    <label key={s.id} className="an-check">
                      <input type="checkbox" checked={d.sections.includes(s.id)} onChange={() => toggle(s.id)} />
                      <span>{s.label} <span className="tiny muted">· {s.term}</span></span>
                    </label>
                  ))}
                </div>
              );
            })}
            {sections.filter((s) => !s.course).map((s) => (
              <label key={s.id} className="an-check">
                <input type="checkbox" checked={d.sections.includes(s.id)} onChange={() => toggle(s.id)} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="small muted">You have no classes yet. Open a class in My classes first.</p>
        ))}

      <label className="fld" htmlFor={`${prefix}-days`}>Show to students</label>
      <select
        id={`${prefix}-days`}
        value={String(d.days)}
        onChange={(e) => set({ days: e.target.value === "same" ? "same" : Number(e.target.value) })}
      >
        {editingId && <option value="same">Keep the same end date</option>}
        {SHOW_FOR.map((o) => (
          <option key={o.days} value={o.days}>{o.label}</option>
        ))}
      </select>

      {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}
      <div className="row" style={{ marginTop: 12 }}>
        <button type="submit" className="btn act k-post" disabled={busy}>
          {busy ? "Saving…" : editingId ? "Save changes" : "Post announcement"}
        </button>
        {editingId && (
          <button type="button" className="btn ghost" onClick={onDone} disabled={busy}>Cancel</button>
        )}
      </div>
    </form>
  );
}

function Actions({ a, sections, isAdmin }: { a: AnnouncementShown; sections: SectionChoice[]; isAdmin: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Remove “${a.title}”? Students will no longer see it.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error || "It could not be removed. Please try again.");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!a.canEdit) return null;
  if (editing) {
    return (
      <AnnouncementForm
        sections={sections}
        isAdmin={isAdmin}
        editingId={a.id}
        initial={{ title: a.title, body: a.body, all: a.audience === "all", sections: a.sections, days: "same" }}
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <>
      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="btn ghost sm" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
        <button type="button" className="btn ghost sm sv-danger" onClick={remove} disabled={busy}>
          {busy ? "Removing…" : "Remove"}
        </button>
      </div>
      {error && <div className="err" style={{ marginTop: 8 }}>{error}</div>}
    </>
  );
}

/**
 * Announcements on a teacher's or administrator's Home page: post to your
 * classes (administrators: to any class or to everyone), and see, change or
 * remove what has been posted.
 */
export default function AnnouncementsPanel({
  items,
  sections,
  isAdmin,
}: {
  items: AnnouncementShown[];
  sections: SectionChoice[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  const live = items.filter((a) => !a.ended);
  const ended = items.filter((a) => a.ended);
  const list = showEnded ? items : live;

  return (
    <section className="an-panel staff" id="announcements" aria-label="Announcements">
      <div className="an-head">
        <span className="an-ico">
          <Megaphone />
        </span>
        <h3>Announcements</h3>
        <span className="an-count">{live.length} showing</span>
        <button type="button" className="btn sm act k-post" style={{ marginLeft: "auto" }} onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "+ New announcement"}
        </button>
      </div>
      <p className="small muted" style={{ margin: "2px 0 0" }}>
        Students see these at the top of their Home page.{" "}
        {isAdmin ? "Post to one or more classes, or to everyone in the academy." : "Post to one or more of your classes."}
      </p>

      {open && (
        <AnnouncementForm
          sections={sections}
          isAdmin={isAdmin}
          initial={{ title: "", body: "", all: false, sections: sections.length === 1 ? [sections[0].id] : [], days: 0 }}
          onDone={() => setOpen(false)}
        />
      )}

      {list.length ? (
        list.map((a) => (
          <AnnouncementItem key={a.id} a={a} staffView>
            <Actions a={a} sections={sections} isAdmin={isAdmin} />
          </AnnouncementItem>
        ))
      ) : (
        <p className="small muted an-empty">Nothing posted yet.</p>
      )}

      {ended.length > 0 && (
        <button type="button" className="sv-x" style={{ marginTop: 8 }} onClick={() => setShowEnded((v) => !v)}>
          {showEnded ? "Hide ended announcements" : `Show ${ended.length} ended announcement${ended.length === 1 ? "" : "s"}`}
        </button>
      )}
    </section>
  );
}
