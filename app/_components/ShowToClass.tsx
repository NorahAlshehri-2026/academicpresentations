"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StaffVideoPlayer from "./StaffVideoPlayer";
import { clipName, type VideoSetShown } from "@/app/_lib/staff-video-types";

/**
 * "Show to class": a teacher plays a recorded lecture's videos on the classroom screen.
 * The video fills the screen on a dark background with the title above it and
 * a button for each video below, and nothing else of the academy shows, so
 * students see the video only. Students themselves can never open teacher
 * videos.
 */
export default function ShowToClass({ set, courseTitle }: { set: VideoSetShown; courseTitle: string }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const [full, setFull] = useState(false);
  const [canFull, setCanFull] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const clips = set.clips;
  const clip = clips[Math.min(at, clips.length - 1)];

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setOpen(false);
    opener.current?.focus();
  }, []);

  function start(i: number) {
    setAt(i);
    setOpen(true);
    // fill the screen straight away; the press on the button allows it
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) close();
      if (e.key === "ArrowRight" && !(e.target instanceof HTMLVideoElement)) setAt((n) => Math.min(clips.length - 1, n + 1));
      if (e.key === "ArrowLeft" && !(e.target instanceof HTMLVideoElement)) setAt((n) => Math.max(0, n - 1));
    };
    const onFull = () => setFull(!!document.fullscreenElement);
    onFull();
    // iPhones cannot fill the screen with a page; their video player has its own full-screen button
    setCanFull(typeof document.documentElement.requestFullscreen === "function");
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", keys);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      document.body.style.overflow = scroll;
      window.removeEventListener("keydown", keys);
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, [open, close, clips.length]);

  if (!clips.length) return null;

  return (
    <>
      <button ref={opener} type="button" className="btn sm sv-show" onClick={() => start(0)}>
        <span aria-hidden="true">▶</span> Show to class
      </button>

      {open && clip && (
        <div className="stc" role="dialog" aria-modal="true" aria-label={`Showing ${set.title}`}>
          <div className="stc-top">
            <div className="stc-name">
              <b>{set.title}</b>
              <span>
                {courseTitle}
                {clips.length > 1 ? ` · ${clipName(clip, at)} (${at + 1} of ${clips.length})` : clip.label ? ` · ${clip.label}` : ""}
              </span>
            </div>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              {canFull && (
                <button type="button" className="btn ghost sm" onClick={toggleFull}>
                  {full ? "Exit full screen" : "Full screen"}
                </button>
              )}
              <button ref={closeBtn} type="button" className="btn ghost sm" onClick={close} aria-label="Close and go back">
                ✕ Close
              </button>
            </div>
          </div>

          <div className="stc-stage">
            {/* a new player for each video, so switching stops the one before */}
            <StaffVideoPlayer key={clip.id} clip={clip} title={`${set.title}: ${clipName(clip, at)}`} load />
          </div>

          {clips.length > 1 && (
            <div className="stc-parts" role="group" aria-label="Videos in this lecture">
              <button type="button" className="stc-step" onClick={() => setAt((n) => Math.max(0, n - 1))} disabled={at === 0} aria-label="Previous video">
                ‹
              </button>
              {clips.map((c, i) => (
                <button key={c.id} type="button" aria-pressed={i === at} onClick={() => setAt(i)}>
                  <b>{i + 1}</b> {clipName(c, i)}
                </button>
              ))}
              <button type="button" className="stc-step" onClick={() => setAt((n) => Math.min(clips.length - 1, n + 1))} disabled={at === clips.length - 1} aria-label="Next video">
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
