"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Plays a recording. Recordings made in the browser often carry no length,
 * which leaves the player stuck at 0:00 with no seek bar; this nudges the
 * browser to work the length out.
 */
export default function MediaPlayer({ src, video }: { src: string; video?: boolean }) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMeta = () => {
      if (el.duration === Infinity || Number.isNaN(el.duration)) {
        const back = () => {
          el.removeEventListener("timeupdate", back);
          el.currentTime = 0;
        };
        el.addEventListener("timeupdate", back);
        el.currentTime = 1e101;
      }
    };
    el.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => el.removeEventListener("loadedmetadata", onMeta);
  }, [src]);

  if (failed) {
    return (
      <p className="small muted">
        This recording will not play in this browser. Try Chrome on a computer; if it will not play there either,
        the file was saved empty: tell your teacher, and the administrator can clear the attempt so it can be recorded again.
      </p>
    );
  }

  return video ? (
    <video ref={(el) => { ref.current = el; }} className="play" controls playsInline preload="metadata" src={src} onError={() => setFailed(true)} />
  ) : (
    <audio ref={(el) => { ref.current = el; }} controls preload="metadata" src={src} onError={() => setFailed(true)} />
  );
}
