"use client";

import { useEffect, useRef } from "react";
import "./symbol-sprint.css";
import { ABBREVS, GAPS, ROUNDS, SAME, SHRINK, SYMBOLS } from "@/app/_lib/symbol-sprint";

/**
 * Symbol Sprint: a timed practice game for the note-taking symbols of
 * Coursebook Unit 5, in three rounds (Match it, Fill the gap, Shrink it).
 * It is practice only: nothing is graded or saved to the database. The best
 * score and the sound setting stay in this browser, kept per account.
 *
 * The game draws its own screens inside the box this component renders, so
 * React only mounts and unmounts it.
 */

const FONTS =
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Kalam:wght@400;700&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap";

const BOOK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/></svg>';
const SOUND_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path data-ss="waves" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';

const MARKUP = `
<div class="ss-top">
  <div class="ss-brand"><b>Symbol <i>→</i> Sprint</b><span>Coursebook Unit 5 · Note taking</span></div>
  <button class="ss-icon" data-ss="btnKey" type="button">${BOOK_ICON}<span class="ss-lbl">Symbol key</span></button>
  <button class="ss-icon" data-ss="btnSound" type="button" aria-pressed="true" title="Sound on or off">${SOUND_ICON}<span class="ss-lbl" data-ss="soundLabel">Sound</span></button>
</div>

<section data-ss="screen-start" class="ss-hero">
  <div class="ss-kicker">Practice game · not graded</div>
  <h1>Write less.<br>Catch more.</h1>
  <p class="ss-lead">Lecturers speak about 150 words a minute. You can write 20 to 30. Race the clock and turn long sentences into short, clear notes with symbols and abbreviations.</p>
  <div class="ss-sheet"><div class="ss-in ss-demo" aria-label="Example: a full sentence turned into a short note">
    <s>Cities are home to 55% of the world's population, and this will rise to 68% by 2050.</s>
    <span>cities <em>=</em> 55% world pop. <em>→</em> 68% by 2050</span>
  </div></div>
  <div class="ss-rounds" data-ss="roundCards"></div>
  <div class="ss-how">
    <span><b>Faster answers</b> earn bonus points.</span>
    <span><b>3 in a row</b> doubles your points. <b>6 in a row</b> triples them.</span>
    <span>Use keys <b>1–4</b> to answer and <b>Enter</b> to go on.</span>
  </div>
  <div class="ss-row">
    <button class="ss-btn" data-ss="btnStart" type="button">Start the sprint · 3 rounds</button>
    <span class="ss-best">Best score <strong data-ss="bestScore">0</strong></span>
  </div>
</section>

<section data-ss="screen-round" class="ss-center" hidden></section>

<section data-ss="screen-play" class="ss-play" hidden>
  <div class="ss-hud">
    <div class="rl"><span data-ss="hudRound">Round 1 · Match it</span><small data-ss="hudQ">Question 1 of 10</small></div>
    <div class="ss-stat streak">Streak<b data-ss="hudStreak">0</b></div>
    <div class="ss-stat">Score<b data-ss="hudScore">0</b></div>
  </div>
  <div class="ss-dots" data-ss="dots" aria-hidden="true"></div>
  <div class="ss-timer" data-ss="timer" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i data-ss="timerBar"></i></div>
  <div class="ss-sheet"><div class="ss-in">
    <div class="ss-ask" data-ss="ask"></div>
    <div class="ss-prompt" data-ss="prompt"></div>
  </div></div>
  <div class="ss-opts" data-ss="opts"></div>
  <div class="ss-fb" data-ss="fb" aria-live="polite"><p data-ss="fbText"></p><button class="ss-btn" data-ss="btnNext" type="button" hidden>Next</button></div>
</section>

<section data-ss="screen-end" class="ss-center" hidden></section>

<section data-ss="screen-key" class="ss-keyp" hidden>
  <div class="ss-row" style="justify-content:space-between">
    <div><div class="ss-kicker">Study first</div><h2>Your symbol key</h2></div>
    <button class="ss-btn ghost" data-ss="btnKeyBack" type="button">Back</button>
  </div>
  <div class="ss-sheet"><div class="ss-in"><div class="ss-keygrid" data-ss="keyGrid"></div></div></div>
</section>
<canvas class="ss-fx" data-ss="fx" aria-hidden="true"></canvas>`;

type Item = { s: string; m: string; kind: "symbol" | "abbreviation" };
type Opt = { t: string; ok: boolean; why?: string };
type Q = { type: "s2m" | "m2s" | "gap" | "shrink"; ask: string; prompt: string; opts: Opt[]; key: { s: string; m: string }; why: string; answer?: string };

function mount(root: HTMLElement, player: string): () => void {
  const $ = (id: string) => root.querySelector<HTMLElement>(`[data-ss="${id}"]`)!;
  const esc = (t: string) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const shuffle = <T,>(a: T[]): T[] => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const sample = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KEY = `symbol-sprint:${player}:`;
  const store = {
    get<T>(k: string, d: T): T {
      try {
        const v = localStorage.getItem(KEY + k);
        return v === null ? d : (JSON.parse(v) as T);
      } catch {
        return d;
      }
    },
    set(k: string, v: unknown) {
      try {
        localStorage.setItem(KEY + k, JSON.stringify(v));
      } catch {
        // storage blocked: the game still works, the best score is not kept
      }
    },
  };
  const ALL: Item[] = [
    ...SYMBOLS.map(([s, m]): Item => ({ s, m, kind: "symbol" })),
    ...ABBREVS.map(([s, m]): Item => ({ s, m, kind: "abbreviation" })),
  ];
  const meaningOf = (s: string) => ALL.find((x) => x.s === s)?.m ?? "";

  root.innerHTML = MARKUP;

  // ---- sound
  let sound = store.get("sound", true);
  let ac: AudioContext | null = null;
  const tone = (freqs: number[], dur: number, type: OscillatorType = "triangle") => {
    if (!sound) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      ac = ac || new Ctx();
      const t0 = ac.currentTime;
      freqs.forEach((f, i) => {
        const o = ac!.createOscillator();
        const g = ac!.createGain();
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + i * dur);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + i * dur + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * dur);
        o.connect(g).connect(ac!.destination);
        o.start(t0 + i * dur);
        o.stop(t0 + (i + 1) * dur + 0.02);
      });
    } catch {
      // no audio on this device
    }
  };
  const sfx = { right: () => tone([660, 880], 0.09), wrong: () => tone([220, 170], 0.13, "sawtooth"), done: () => tone([523, 659, 784, 1046], 0.11) };
  const paintSound = () => {
    $("btnSound").setAttribute("aria-pressed", String(sound));
    $("soundLabel").textContent = sound ? "Sound on" : "Sound off";
    $("waves").style.display = sound ? "" : "none";
  };

  // ---- state
  const S = { mode: "all" as "all" | "one", round: 0, qs: [] as Q[], qi: 0, score: 0, streak: 0, bestStreak: 0, right: 0, total: 0,
    results: [] as boolean[], missed: [] as { s: string; m: string }[], roundRight: 0, locked: false, t0: 0, raf: 0, timeLimit: 10 };
  const screens = ["screen-start", "screen-round", "screen-play", "screen-end", "screen-key"];
  const show = (id: string) => {
    screens.forEach((s) => ($(s).hidden = s !== id));
    root.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  };

  // ---- questions
  const buildMatch = (n: number): Q[] => {
    const pick = sample(ALL.filter((x) => x.kind === "symbol"), 6).concat(sample(ALL.filter((x) => x.kind === "abbreviation"), n - 6));
    return shuffle(pick).map((item) => {
      const pool = ALL.filter((x) => x.s !== item.s && x.s !== SAME[item.s] && x.m !== item.m && x.kind === item.kind);
      const opts = shuffle([item].concat(sample(pool, 3)));
      const flip = Math.random() < 0.4;
      return flip
        ? { type: "m2s", ask: "Which symbol or abbreviation means this?", prompt: item.m, opts: opts.map((x) => ({ t: x.s, ok: x === item })), key: item, why: `${item.s} = ${item.m}` }
        : { type: "s2m", ask: `What does this ${item.kind} mean?`, prompt: item.s, opts: opts.map((x) => ({ t: x.m, ok: x === item })), key: item, why: `${item.s} = ${item.m}` };
    });
  };
  const buildGap = (n: number): Q[] =>
    sample(GAPS, n).map((g) => ({ type: "gap", ask: "Which symbol completes the note?", prompt: g.note, opts: shuffle(g.o).map((t) => ({ t, ok: t === g.a })),
      key: { s: g.a, m: meaningOf(g.a) }, why: g.why, answer: g.a }));
  const buildShrink = (n: number): Q[] =>
    sample(SHRINK, n).map((q) => ({ type: "shrink", ask: "Which is the best note?", prompt: q.s,
      opts: shuffle(q.o.map(([t, why], i) => ({ t, ok: i === 0, why }))), key: { s: "note", m: q.o[0][0] }, why: `Best note: ${q.o[0][0]}` }));

  // ---- flow
  const resetTotals = () => Object.assign(S, { score: 0, streak: 0, bestStreak: 0, right: 0, total: 0, missed: [] });
  const startAll = () => { S.mode = "all"; resetTotals(); introRound(0); };
  const startOne = (i: number) => { S.mode = "one"; resetTotals(); introRound(i); };

  function introRound(i: number) {
    S.round = i;
    const r = ROUNDS[i];
    const all = S.mode === "all";
    $("screen-round").innerHTML =
      `<div class="ss-kicker">Round ${all ? i + 1 : 1} of ${all ? ROUNDS.length : 1}</div>` +
      `<h2 style="font-size:clamp(40px,9vw,60px)">${esc(r.name)}</h2>` +
      `<div class="ss-rintro"><p class="rule">${esc(r.rule)}</p><p class="eg">${esc(r.eg)}</p>` +
      `<p class="rule"><b>${r.n} questions</b> · ${r.time} seconds each</p></div>` +
      `<button class="ss-btn" data-ss="btnGo" type="button">Go</button>`;
    show("screen-round");
    $("btnGo").addEventListener("click", () => playRound(i));
    $("btnGo").focus({ preventScroll: true });
  }

  function playRound(i: number) {
    const r = ROUNDS[i];
    S.qs = r.id === "match" ? buildMatch(r.n) : r.id === "gap" ? buildGap(r.n) : buildShrink(r.n);
    Object.assign(S, { qi: 0, results: [], roundRight: 0, timeLimit: r.time });
    show("screen-play");
    ask();
  }

  function ask() {
    const r = ROUNDS[S.round];
    const q = S.qs[S.qi];
    S.locked = false;
    $("hudRound").textContent = (S.mode === "all" ? `Round ${S.round + 1} · ` : "") + r.name;
    $("hudQ").textContent = `Question ${S.qi + 1} of ${S.qs.length}`;
    paintHud();
    $("dots").innerHTML = S.qs.map((_, k) => `<i class="${k < S.qi ? (S.results[k] ? "d-ok" : "d-no") : k === S.qi ? "d-now" : ""}"></i>`).join("");
    $("ask").textContent = q.ask;

    const p = $("prompt");
    if (q.type === "s2m") p.innerHTML = `<span class="ss-p-sym">${esc(q.prompt)}</span>`;
    else if (q.type === "m2s") p.innerHTML = `<span class="ss-p-mean">${esc(q.prompt)}</span>`;
    else if (q.type === "gap") p.innerHTML = `<span class="ss-p-note">${esc(q.prompt).replace("{}", '<span class="gap" data-ss="gapSlot">?</span>')}</span>`;
    else p.innerHTML = `<span class="ss-p-sent">${esc(q.prompt)}</span>`;

    const box = $("opts");
    box.className = "ss-opts" + (q.type === "gap" ? " ss-tiles" : q.type === "shrink" ? " ss-list" : "");
    const cls = q.type === "m2s" ? " sym" : q.type === "shrink" ? " hand" : "";
    box.innerHTML = q.opts.map((o, k) => `<button class="ss-opt${cls}" type="button" data-k="${k}"><span class="k">${k + 1}</span>${esc(o.t)}</button>`).join("");
    box.querySelectorAll<HTMLButtonElement>(".ss-opt").forEach((b) => b.addEventListener("click", () => choose(Number(b.dataset.k), b)));

    $("fb").className = "ss-fb";
    $("fbText").textContent = "";
    $("btnNext").hidden = true;
    startTimer();
  }

  function startTimer() {
    cancelAnimationFrame(S.raf);
    S.t0 = performance.now();
    const bar = $("timerBar");
    const wrap = $("timer");
    const tick = (now: number) => {
      const left = Math.max(0, 1 - (now - S.t0) / (S.timeLimit * 1000));
      bar.style.transform = `scaleX(${left})`;
      wrap.classList.toggle("low", left < 0.3);
      wrap.setAttribute("aria-valuenow", String(Math.round(left * 100)));
      if (left <= 0) return choose(-1, null);
      if (!S.locked) S.raf = requestAnimationFrame(tick);
    };
    S.raf = requestAnimationFrame(tick);
  }

  function choose(k: number, btn: HTMLElement | null) {
    if (S.locked) return;
    S.locked = true;
    cancelAnimationFrame(S.raf);
    const q = S.qs[S.qi];
    const left = Math.max(0, 1 - (performance.now() - S.t0) / (S.timeLimit * 1000));
    const buttons = Array.from($("opts").querySelectorAll<HTMLButtonElement>(".ss-opt"));
    const correct = q.opts.findIndex((o) => o.ok);
    const ok = k >= 0 && q.opts[k].ok;
    buttons.forEach((b) => (b.disabled = true));
    buttons[correct].classList.add("right");
    S.total += 1;

    if (ok) {
      S.streak += 1;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      S.right += 1;
      S.roundRight += 1;
      const mult = S.streak >= 6 ? 3 : S.streak >= 3 ? 2 : 1;
      const pts = Math.round((100 + 50 * left) * mult);
      S.score += pts;
      popPoints(`+${pts}${mult > 1 ? " ×" + mult : ""}`, btn);
      sfx.right();
      if (q.type === "gap") root.querySelector<HTMLElement>('[data-ss="gapSlot"]')!.textContent = q.answer ?? "";
      $("fb").className = "ss-fb good";
      $("fbText").innerHTML = `<b>${S.streak >= 3 ? "On fire!" : "Correct!"}</b>${esc(q.type === "shrink" ? "Short, clear and correct." : q.why)}`;
    } else {
      S.streak = 0;
      if (btn) btn.classList.add("wrong");
      sfx.wrong();
      const extra = q.type === "shrink" && k >= 0 ? (q.opts[k].why ?? "") + " " : "";
      $("fb").className = "ss-fb bad";
      $("fbText").innerHTML = `<b>${k < 0 ? "Too slow" : "Not quite"}</b>${esc((k < 0 ? "Time is up. " : "") + extra + q.why)}`;
      if (q.type === "shrink") S.missed.push({ s: "note", m: q.opts[correct].t });
      else if (!S.missed.some((m) => m.s === q.key.s)) S.missed.push(q.key);
    }
    S.results[S.qi] = ok;
    paintHud();
    const dot = $("dots").children[S.qi];
    if (dot) dot.className = ok ? "d-ok" : "d-no";
    const next = $("btnNext");
    next.hidden = false;
    next.textContent = S.qi + 1 < S.qs.length ? "Next" : "See results";
    next.focus({ preventScroll: true });
  }

  function goNext() {
    if (!S.locked) return;
    if (S.qi + 1 < S.qs.length) {
      S.qi += 1;
      ask();
    } else endRound();
  }

  function paintHud() {
    $("hudScore").textContent = S.score.toLocaleString("en-US");
    const mult = S.streak >= 6 ? 3 : S.streak >= 3 ? 2 : 1;
    $("hudStreak").innerHTML = String(S.streak) + (mult > 1 ? `<span class="mult">×${mult}</span>` : "");
  }

  function endRound() {
    const r = ROUNDS[S.round];
    const pct = S.roundRight / S.qs.length;
    if (pct >= 0.8) confetti();
    sfx.done();
    if (S.mode === "one" || S.round === ROUNDS.length - 1) return finish();
    $("screen-round").innerHTML =
      `<div class="ss-kicker">Round ${S.round + 1} complete</div>` +
      `<h2>${esc(r.name)}: ${S.roundRight} / ${S.qs.length}</h2>` +
      `<div class="ss-facts"><div>Score so far<b>${S.score.toLocaleString("en-US")}</b></div><div>Best streak<b>${S.bestStreak}</b></div></div>` +
      `<p class="ss-lead">${pct >= 0.8 ? "Excellent. Keep that speed." : pct >= 0.5 ? "Good work. Read each option to the end before you tap." : "Keep going. Open the symbol key after the sprint and study the ones you missed."}</p>` +
      `<button class="ss-btn" data-ss="btnNextRound" type="button">Round ${S.round + 2}: ${esc(ROUNDS[S.round + 1].name)}</button>`;
    show("screen-round");
    $("btnNextRound").addEventListener("click", () => introRound(S.round + 1));
    $("btnNextRound").focus({ preventScroll: true });
  }

  function finish() {
    const acc = S.total ? S.right / S.total : 0;
    const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : acc >= 0.4 ? 1 : 0;
    const title = ["Warm-up done", "Getting faster", "Fast writer", "Note-taking pro"][stars];
    const best = store.get("best", 0);
    const isBest = S.mode === "all" && S.score > best;
    if (isBest) store.set("best", S.score);
    paintBest();
    const star = (on: boolean) =>
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="${on ? "var(--ss-gold)" : "none"}" stroke="var(--ss-gold)" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    const missed = S.missed.slice(0, 12);
    $("screen-end").innerHTML =
      `<div class="ss-kicker">${S.mode === "all" ? "Sprint complete" : esc(ROUNDS[S.round].name) + " complete"}</div>` +
      `<h2 style="font-size:clamp(36px,8vw,54px)">${title}</h2>` +
      `<div class="ss-stars" role="img" aria-label="${stars} of 3 stars">${[0, 1, 2].map((i) => star(i < stars)).join("")}</div>` +
      `<div class="ss-big">${S.score.toLocaleString("en-US")}</div>` +
      (isBest ? '<p class="ss-lead"><b>New best score.</b></p>' : "") +
      `<div class="ss-facts"><div>Correct<b>${S.right} / ${S.total}</b></div><div>Accuracy<b>${Math.round(acc * 100)}%</b></div><div>Best streak<b>${S.bestStreak}</b></div></div>` +
      (missed.length
        ? `<div class="ss-missed ss-sheet"><div class="ss-in"><h3>Review these</h3><ul>${missed
            .map((m) => `<li><span class="s">${m.s === "note" ? "✎" : esc(m.s)}</span><span class="m">${esc(m.m)}</span></li>`)
            .join("")}</ul></div></div>`
        : '<p class="ss-lead">No mistakes. Try to beat your score with faster answers.</p>') +
      `<div class="ss-row"><button class="ss-btn" data-ss="btnAgain" type="button">Play again</button><button class="ss-btn ghost" data-ss="btnHome" type="button">Choose a round</button><button class="ss-btn ghost" data-ss="btnStudy" type="button">Symbol key</button></div>`;
    show("screen-end");
    $("btnAgain").addEventListener("click", () => (S.mode === "all" ? startAll() : startOne(S.round)));
    $("btnHome").addEventListener("click", () => show("screen-start"));
    $("btnStudy").addEventListener("click", openKey);
    $("btnAgain").focus({ preventScroll: true });
    if (stars === 3) confetti();
  }

  // ---- key + start screen
  let keyReturn = "screen-start";
  function openKey() {
    const cur = screens.slice(0, 4).find((s) => !$(s).hidden) ?? "screen-start";
    if (cur === "screen-play" && !S.locked) return; // answer the question first
    keyReturn = cur;
    show("screen-key");
  }
  const kv = ([s, m]: [string, string]) => `<div class="ss-kv"><b>${esc(s)}</b><span>${esc(m)}</span></div>`;
  $("keyGrid").innerHTML = `<h3>Symbols</h3>${SYMBOLS.map(kv).join("")}<h3>Abbreviations</h3>${ABBREVS.map(kv).join("")}`;
  $("roundCards").innerHTML = ROUNDS.map(
    (r, i) =>
      `<button class="ss-rcard" type="button" data-r="${i}"><span class="n">Round ${i + 1} · ${r.n} questions</span><b>${esc(r.name)}</b>` +
      `<span>${esc(r.card)}</span><span class="eg">${esc(r.cardEg)}</span><span class="go">Practise this round →</span></button>`
  ).join("");
  $("roundCards").querySelectorAll<HTMLButtonElement>(".ss-rcard").forEach((b) => b.addEventListener("click", () => startOne(Number(b.dataset.r))));
  const paintBest = () => ($("bestScore").textContent = store.get("best", 0).toLocaleString("en-US"));

  // ---- effects
  const timers = new Set<number>();
  function popPoints(text: string, near: HTMLElement | null) {
    if (reduced) return;
    const el = document.createElement("div");
    el.className = "ss-pop";
    el.textContent = text;
    const r = (near ?? $("prompt")).getBoundingClientRect();
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${r.top}px`;
    root.appendChild(el);
    const t = window.setTimeout(() => {
      el.remove();
      timers.delete(t);
    }, 950);
    timers.add(t);
  }
  let fxRaf = 0;
  function confetti() {
    if (reduced) return;
    const c = $("fx") as HTMLCanvasElement;
    const g = c.getContext("2d");
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(root);
    const cols = ["--ss-gold", "--ss-navy", "--ss-good", "--ss-margin"].map((v) => css.getPropertyValue(v).trim() || "#c89432");
    const glyphs = ["→", "↑", "★", "=", "∴", "+", "~"];
    const parts = Array.from({ length: 70 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 4,
      r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.3, c: cols[Math.floor(Math.random() * cols.length)],
      t: Math.random() < 0.45 ? glyphs[Math.floor(Math.random() * glyphs.length)] : null, s: 6 + Math.random() * 6,
    }));
    const t0 = performance.now();
    cancelAnimationFrame(fxRaf);
    const frame = (now: number) => {
      const dt = now - t0;
      g.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.c;
        g.globalAlpha = Math.max(0, 1 - dt / 1800);
        if (p.t) {
          g.font = `700 ${p.s * 2.4}px Kalam, sans-serif`;
          g.fillText(p.t, 0, 0);
        } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      });
      if (dt < 1800) fxRaf = requestAnimationFrame(frame);
      else g.clearRect(0, 0, innerWidth, innerHeight);
    };
    fxRaf = requestAnimationFrame(frame);
  }

  // ---- wiring
  paintBest();
  paintSound();
  $("btnStart").addEventListener("click", startAll);
  $("btnNext").addEventListener("click", goNext);
  $("btnKey").addEventListener("click", openKey);
  $("btnKeyBack").addEventListener("click", () => show(keyReturn));
  $("btnSound").addEventListener("click", () => {
    sound = !sound;
    store.set("sound", sound);
    paintSound();
    if (sound) sfx.right();
  });
  const onKey = (e: KeyboardEvent) => {
    if ($("screen-play").hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4 && !S.locked) {
      const b = $("opts").querySelectorAll<HTMLButtonElement>(".ss-opt")[n - 1];
      if (b) {
        e.preventDefault();
        choose(n - 1, b);
      }
    } else if (e.key === "Enter" && S.locked && document.activeElement !== $("btnNext")) {
      e.preventDefault();
      goNext();
    }
  };
  document.addEventListener("keydown", onKey);

  return () => {
    document.removeEventListener("keydown", onKey);
    cancelAnimationFrame(S.raf);
    cancelAnimationFrame(fxRaf);
    timers.forEach((t) => clearTimeout(t));
    if (ac) ac.close().catch(() => undefined);
    root.innerHTML = "";
  };
}

export default function SymbolSprint({ player }: { player: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    return mount(box.current, player);
  }, [player]);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTS} />
      <div ref={box} className="ss" />
    </>
  );
}
