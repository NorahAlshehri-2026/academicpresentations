"use client";

import { useState } from "react";
import { SOURCE_NAMES, playsInFrame, posterFor, type ClipShown } from "@/app/_lib/staff-video-types";

const FRAME_ALLOW = "autoplay; fullscreen; picture-in-picture; encrypted-media";

/** Adds autoplay to a player address, so one press on the cover starts the video. */
function autoplay(src: string) {
  return src + (src.includes("?") ? "&" : "?") + "autoplay=1";
}

/**
 * One teacher video: an uploaded file or a direct link plays in the browser's
 * own player; YouTube, Google Drive, Vimeo and OneDrive/SharePoint play in
 * their own player. Those load only when pressed (load), so a page of many
 * videos stays quick.
 */
export default function StaffVideoPlayer({ clip, title, load = false }: { clip: ClipShown; title: string; load?: boolean }) {
  const [open, setOpen] = useState(load);

  if (!clip.src) {
    return (
      <div className="sv-frame sv-missing">
        <p className="small">This video could not be loaded. Reload the page to try again.</p>
      </div>
    );
  }

  if (!playsInFrame(clip)) {
    return (
      <div className="sv-frame">
        <video controls playsInline preload="metadata" controlsList="nodownload" src={clip.src} title={title} />
      </div>
    );
  }

  const source = clip.kind === "link" ? clip.source : "direct";
  if (!open) {
    const poster = clip.kind === "link" ? posterFor(clip) : "";
    return (
      <div className="sv-frame">
        <button
          type="button"
          className={`sv-cover sv-${source}`}
          style={poster ? { backgroundImage: `url(${poster})` } : undefined}
          onClick={() => setOpen(true)}
          aria-label={`Play ${title}`}
        >
          <span className="sv-playbtn" aria-hidden="true" />
          <span className="sv-src">{SOURCE_NAMES[source]}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="sv-frame">
      <iframe
        src={load ? clip.src : autoplay(clip.src)}
        title={title}
        allow={FRAME_ALLOW}
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
