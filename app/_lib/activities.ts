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

/** The workbook reference, criterion group and one-line task for each speaking task. */
export const ACTIVITY_INFO: Record<string, { skill: string; source: string; task: string }> = {
  a1: { skill: "intro", source: "Unit 1, exercise 3.4", task: "Choose one topic and open a presentation on it. Greet the audience, state the topic, say what you intend to do, and preview your points." },
  a2: { skill: "intro", source: "Unit 4, exercise 2.2", task: "Open using an alternative technique: a surprising fact, a question to the audience, or asking them to do something. Then move into topic and purpose." },
  a3: { skill: "intro", source: "Unit 1, exercise 4.5", task: "Deliver the general introduction and overview stages only. State your main theme, then divide it into two or three sub-themes." },
  a4: { skill: "organization", source: "Unit 2, exercise 2.3", task: "Deliver your framework on the invention of penicillin. Add a lead-in phrase before your first sub-theme and pause in all the right places." },
  a5: { skill: "organization", source: "Unit 2, exercise 3.1", task: "Present a three-part body. Use a different linking phrase to move into each sub-theme, and make the transitions audible." },
  a6: { skill: "delivery", source: "Unit 1, exercise 5.2", task: "Deliver the framework on ways to improve your English. Mark your pauses first, vary your tone, avoid a monotone." },
  a7: { skill: "delivery", source: "Unit 4, exercise 3.2", task: "Read the six statements aloud, each rewritten to carry more impact through word stress." },
  a8: { skill: "language", source: "Unit 3, exercise 5.4", task: "Present two benefits and one concern about AI in healthcare. Acknowledge all three journal articles orally and finish with your own opinion." },
  a9: { skill: "conclusion", source: "Unit 3, exercise 6.3", task: "Deliver a mini presentation, paying particular attention to the last thirty seconds: summarise, signal the end, thank the audience, invite questions." },
  a10: { skill: "all", source: "All five units", task: "Deliver a complete five-minute presentation: opening, overview, three developed sub-themes with sources acknowledged, and a signalled ending with questions invited." },
};

export const SKILL_GROUPS: [string, string][] = [
  ["intro", "1 · Introduction and structure"],
  ["organization", "2 · Organization and content"],
  ["delivery", "3 · Delivery and engagement"],
  ["language", "4 · Academic language and sources"],
  ["conclusion", "5 · Conclusion and professionalism"],
  ["all", "Putting it together"],
];

/** The workbook's unit for each task, as the original studio grouped them. */
export const UNIT_OF_ACTIVITY: Record<string, number> = {
  a1: 1, a3: 1, a6: 1, a4: 2, a5: 2, a8: 3, a9: 3, a2: 4, a7: 4, a10: 5,
};
