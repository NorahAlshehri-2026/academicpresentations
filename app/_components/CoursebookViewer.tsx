"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CbBox, CbManifest } from "@/app/_lib/coursebook-types";

const RATES = [1, 0.75];

function mmss(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const boxStyle = (b: CbBox, grow = 0): React.CSSProperties => ({
  left: pct(b[0] - grow),
  top: pct(b[1] - grow),
  width: pct(b[2] + 2 * grow),
  height: pct(b[3] + 2 * grow),
});

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor" />
  </svg>
);

/**
 * The workbook, page by page, as it is printed. Each gold Track label is a play
 * button; the contents and page references jump to their page. One recording
 * plays at a time, in the player bar at the foot of the screen.
 */
export default function CoursebookViewer({ book, startPage }: { book: CbManifest; startPage?: number }) {
  const total = book.pages.length;
  const audio = useRef<HTMLAudioElement | null>(null);
  const rateRef = useRef(RATES[0]);
  const [track, setTrack] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(RATES[0]);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(startPage ?? 1);
  const [jump, setJump] = useState("");

  const go = useCallback((n: number | null | undefined, smooth = true) => {
    if (!n) return;
    document.getElementById(`cb-p${n}`)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }, []);

  // open at the requested page
  useEffect(() => {
    if (startPage && startPage > 1) go(startPage, false);
  }, [startPage, go]);

  // which page is in the middle of the screen
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setPage(Number((e.target as HTMLElement).dataset.n));
      },
      { rootMargin: "-45% 0px -54% 0px" }
    );
    document.querySelectorAll<HTMLElement>(".cb-page").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [book]);

  // one audio element for the whole book
  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    audio.current = a;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => {
      setDur(a.duration);
      a.playbackRate = rateRef.current;
    };
    const onEnd = () => {
      setPlaying(false);
      a.currentTime = 0;
      setTime(0);
    };
    const onErr = () => {
      if (a.getAttribute("src")) {
        setFailed(true);
        setPlaying(false);
      }
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
    };
  }, []);

  const play = (t: string) => {
    const a = audio.current;
    if (!a) return;
    if (t === track && !failed) {
      if (a.paused) a.play().catch(() => {});
      else a.pause();
      return;
    }
    setFailed(false);
    setTrack(t);
    setTime(0);
    setDur(0);
    a.src = book.tracks[t]?.src ?? "";
    a.playbackRate = rateRef.current;
    a.play().catch(() => {});
  };

  const close = () => {
    audio.current?.pause();
    setTrack(null);
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rateRef.current) + 1) % RATES.length];
    rateRef.current = next;
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const info = track ? book.tracks[track] : null;
  const unitJumps = [1, 2, 3, 4, 5].filter((u) => book.units[String(u)]);

  return (
    <div className={`cb${track ? " has-player" : ""}`}>
      <div className="card cb-bar">
        <div className="cb-jumps" role="navigation" aria-label="Coursebook sections">
          <button type="button" className="cb-chip" onClick={() => go(book.jumps.contents)}>Contents</button>
          {unitJumps.map((u) => (
            <button
              key={u}
              type="button"
              className="cb-chip unit"
              style={{ ["--unit" as any]: `var(--u${u})` }}
              onClick={() => go(book.units[String(u)])}
            >
              Unit {u}
            </button>
          ))}
          {book.jumps.tracks && (
            <button type="button" className="cb-chip" onClick={() => go(book.jumps.tracks)}>Audio tracks</button>
          )}
        </div>
        <div className="cb-tools">
          <form
            className="cb-goto"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Math.min(total, Math.max(1, parseInt(jump, 10) || 0));
              if (n) go(n);
              setJump("");
            }}
          >
            <label htmlFor="cb-goto">Page</label>
            <input
              id="cb-goto"
              inputMode="numeric"
              placeholder={String(page)}
              value={jump}
              onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
              aria-label={`Go to page (1 to ${total})`}
            />
            <span className="muted">of {total}</span>
          </form>
          {book.pdf && (
            <a className="btn ghost sm" href={book.pdf} target="_blank" rel="noopener">
              Download PDF
            </a>
          )}
        </div>
        <p className="tiny muted cb-hint">
          Press <span className="cb-hint-dot"><PlayIcon /></span> next to a listening exercise to play its recording.
        </p>
      </div>

      <div className="cb-pages">
        {book.pages.map((p, i) => (
          <section key={p.n} id={`cb-p${p.n}`} data-n={p.n} className="cb-page" style={{ aspectRatio: `${p.w} / ${p.h}` }} aria-label={`Page ${p.n}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.img} alt="" width={p.w} height={p.h} loading={i < 2 ? "eager" : "lazy"} decoding="async" />
            <div className="cb-text">{p.text}</div>
            {p.links.map((l, j) => (
              <button key={`l${j}`} type="button" className="cb-link" style={boxStyle(l.box)} aria-label={`Go to page ${l.page}`} onClick={() => go(l.page)} />
            ))}
            {p.ext.map((l, j) => (
              <a key={`e${j}`} className="cb-link" style={boxStyle(l.box)} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${l.href}`} />
            ))}
            {p.tracks.map((t, j) => {
              const k = String(t.t);
              const ti = book.tracks[k];
              if (!ti) return null;
              const current = track === k;
              const on = current && playing;
              // the play disc sits over the printed headphones icon at the left of the label
              const ar = p.h / p.w;
              const pillH = t.box[3] * ar;
              const d = 0.92 * pillH;
              return (
                <button
                  key={`t${j}`}
                  type="button"
                  className={`cb-play${current ? " is-current" : ""}${on ? " is-on" : ""}`}
                  style={boxStyle(t.box)}
                  aria-pressed={on}
                  aria-label={`${on ? "Pause" : "Play"} Track ${k}, Unit ${ti.unit} exercise ${ti.ex}`}
                  onClick={() => play(k)}
                >
                  <span className="cb-disc" style={{ width: pct(d / t.box[2]), left: pct((0.1 * pillH) / t.box[2]) }}>
                    {on ? <PauseIcon /> : <PlayIcon />}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <nav className="cb-pager" aria-label="Pages">
        <button type="button" onClick={() => go(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page">‹</button>
        <span>
          {page} / {total}
        </span>
        <button type="button" onClick={() => go(Math.min(total, page + 1))} disabled={page >= total} aria-label="Next page">›</button>
      </nav>

      {track && info && (
        <div className="cb-player" role="region" aria-label="Audio player">
          <button type="button" className="cb-pp" onClick={() => play(track)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="cb-meta">
            <b>Track {track}</b>
            <button type="button" className="cb-where" onClick={() => go(info.page)}>
              Unit {info.unit} · exercise {info.ex}
            </button>
            <span className="cb-desc">{failed ? "This track did not load. Reload the page, then press play again." : info.desc}</span>
          </div>
          <div className="cb-ctrl">
            <button
              type="button"
              className="cb-small"
              onClick={() => {
                if (audio.current) audio.current.currentTime = Math.max(0, audio.current.currentTime - 5);
              }}
              aria-label="Go back 5 seconds"
            >
              ↺ 5s
            </button>
            <input
              type="range"
              min={0}
              max={dur || 0}
              step={0.1}
              value={Math.min(time, dur || 0)}
              onChange={(e) => {
                if (audio.current) audio.current.currentTime = Number(e.target.value);
                setTime(Number(e.target.value));
              }}
              aria-label={`Position in Track ${track}`}
              disabled={!dur}
            />
            <span className="cb-time">
              {mmss(time)} / {mmss(dur)}
            </span>
            <button type="button" className="cb-small" onClick={cycleRate} aria-label="Playback speed">
              {rate}×
            </button>
            <button type="button" className="cb-small" onClick={close} aria-label="Close the player">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
