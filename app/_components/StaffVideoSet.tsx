"use client";

import { useState } from "react";
import StaffVideoPlayer from "./StaffVideoPlayer";
import StaffVideoActions from "./StaffVideoActions";
import StaffVideoUpload from "./StaffVideoUpload";
import ShowToClass from "./ShowToClass";
import { MAX_CLIPS, SOURCE_NAMES, clipName, megabytes, type VideoSetShown } from "@/app/_lib/staff-video-types";

/**
 * One title on the Teacher videos page: its videos side by side, "Show to
 * class", and (for the teacher who added it, and administrators) adding more
 * videos, editing and deleting.
 */
export default function StaffVideoSet({
  set,
  courseId,
  courseTitle,
  addedOn,
  manage,
}: {
  set: VideoSetShown;
  courseId: string;
  courseTitle: string;
  /** e.g. "11 Nov 2026", formatted on the server */
  addedOn: string;
  manage: boolean;
}) {
  const [mode, setMode] = useState<"view" | "add" | "edit">("view");
  const n = set.clips.length;
  const room = MAX_CLIPS - n;

  return (
    <section className="sv-set" aria-labelledby={`sv-h-${set.id}`}>
      <div className="sv-head">
        <div className="grow">
          <h4 id={`sv-h-${set.id}`}>{set.title}</h4>
          <p className="tiny muted" style={{ margin: "2px 0 0" }}>
            {n} of {MAX_CLIPS} videos · added {addedOn}
            {set.by ? ` by ${set.by}` : ""}
          </p>
        </div>
        <div className="row">
          <ShowToClass set={set} courseTitle={courseTitle} />
          {manage && mode === "view" && room > 0 && (
            <button type="button" className="btn ghost sm" onClick={() => setMode("add")}>+ Add a video</button>
          )}
          {manage && mode === "view" && (
            <button type="button" className="btn ghost sm" onClick={() => setMode("edit")}>Edit</button>
          )}
        </div>
      </div>
      {set.note && <p className="small sv-note">{set.note}</p>}

      {mode === "edit" ? (
        <StaffVideoActions courseId={courseId} set={set} onClose={() => setMode("view")} />
      ) : (
        <div className={`sv-grid n${n}`}>
          {set.clips.map((c, i) => (
            <div className="sv-clip" key={c.id}>
              <StaffVideoPlayer clip={c} title={`${set.title}: ${clipName(c, i)}`} />
              <div className="sv-cap">
                {n > 1 && <b className="sv-n">{i + 1}</b>}
                <span>{clipName(c, i)}</span>
              </div>
              <p className="tiny muted" style={{ margin: 0 }}>
                {c.kind === "file" ? (
                  `Uploaded file · ${megabytes(c.size)}`
                ) : (
                  <>
                    {SOURCE_NAMES[c.source]} ·{" "}
                    <a href={c.url} target="_blank" rel="noopener noreferrer">open on its site ↗</a>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {mode === "add" && (
        <StaffVideoUpload courses={[]} into={{ courseId, setId: set.id, title: set.title, room }} onDone={() => setMode("view")} />
      )}
    </section>
  );
}
