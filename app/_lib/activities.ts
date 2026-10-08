import type { Criterion } from "./rubric";

/**
 * Display details for the course's units and speaking tasks. The lessons
 * themselves live in the database; this only adds colour, and which rubric
 * criteria each task concentrates on (shown as tags). Every task is still
 * marked on all five criteria.
 */

export const UNIT_META: Record<number, { title: string; colour: string; blurb: string }> = {
  1: {
    title: "Getting started with a presentation",
    colour: "#12284a",
    blurb: "The five stages of a talk, opening phrases, main themes and sub-themes, pauses and tone.",
  },
  2: {
    title: "Organizing materials",
    colour: "#2e6b3e",
    blurb: "Narrowing a topic, lead-in phrases, and linking the body of the talk.",
  },
  3: {
    title: "Acknowledging academic sources",
    colour: "#5b3a8c",
    blurb: "Citing sources aloud, integrating evidence, and ending a talk properly.",
  },
  4: {
    title: "Delivering with high impact",
    colour: "#1f7a8c",
    blurb: "Alternative openings, the language that goes with them, and word stress for emphasis.",
  },
  5: {
    title: "Putting it together",
    colour: "#b8860f",
    blurb: "A complete five-minute presentation, marked on all five criteria.",
  },
};

export const unitMeta = (n: number) =>
  UNIT_META[n] ?? { title: `Unit ${n}`, colour: "#12284a", blurb: "" };

export const FOCUS: Record<string, Criterion["id"][]> = {
  a1: ["intro", "language"],
  a2: ["intro", "delivery"],
  a3: ["intro", "organization"],
  a4: ["organization", "intro", "delivery"],
  a5: ["organization", "language"],
  a6: ["delivery"],
  a7: ["delivery"],
  a8: ["language", "organization"],
  a9: ["conclusion", "organization"],
  a10: ["intro", "organization", "delivery", "language", "conclusion"],
};

/** colour class per criterion, used for tags */
export const CRIT_CLASS: Record<string, string> = {
  intro: "c1",
  organization: "c2",
  delivery: "c3",
  language: "c4",
  conclusion: "c5",
};

export const MAX_ATTEMPTS = 2;
