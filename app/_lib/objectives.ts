/**
 * Peer feedback in units 1–4 is checked against the lesson objectives of the
 * task, not the full rubric. The full five-criterion rubric is kept for the
 * complete presentation in the last unit (any task not listed here, i.e. a10).
 *
 * Edit the wording freely: feedback already given keeps the wording it was
 * given with, because the objective text is saved alongside the rating.
 */
export const OBJECTIVES: Record<string, string[]> = {
  // Unit 1
  a1: [
    "Greets the audience and introduces themself",
    "States the topic clearly",
    "Says what they intend to do (the purpose)",
    "Previews the main points",
  ],
  a3: [
    "Gives a general introduction: greeting and self-introduction",
    "States the main theme",
    "Divides the theme into two or three sub-themes",
    "Uses overview language (e.g. “I have divided my talk into…”)",
  ],
  a6: [
    "Pauses in the marked places",
    "Varies tone and avoids a monotone",
    "Keeps a pace the audience can follow",
    "Speaks to the audience rather than reading",
  ],
  // Unit 2
  a4: [
    "Follows a clear framework for the talk",
    "Uses a lead-in phrase before the first sub-theme",
    "Pauses in the right places",
    "Keeps the content accurate and on topic",
  ],
  a5: [
    "Presents three distinct sub-themes in the body",
    "Uses a different linking phrase to move into each sub-theme",
    "Makes each transition clearly audible",
    "Supports each sub-theme with a detail or example",
  ],
  // Unit 3
  a8: [
    "Presents two benefits and one concern",
    "Acknowledges all three journal articles orally",
    "Integrates the evidence into their own sentences",
    "Finishes with their own opinion",
  ],
  a9: [
    "Summarises the main points",
    "Signals the end clearly",
    "Thanks the audience",
    "Invites questions",
  ],
  // Unit 4
  a2: [
    "Opens with an alternative technique: a surprising fact, a question, or an audience task",
    "Uses the language that goes with that technique",
    "Moves smoothly into the topic and purpose",
  ],
  a7: [
    "Stresses the key word in each statement",
    "The stress makes the meaning more emphatic",
    "Delivers all six statements clearly",
    "Keeps a natural pace and rhythm",
  ],
};

export const objectivesFor = (activityKey: string | null | undefined) =>
  (activityKey && OBJECTIVES[activityKey]) || null;

export type Rating = "yes" | "partly" | "no";
export const RATINGS: { id: Rating; label: string; mark: string; cls: string }[] = [
  { id: "yes", label: "Yes", mark: "✓", cls: "c2" },
  { id: "partly", label: "Partly", mark: "◐", cls: "c5" },
  { id: "no", label: "Not yet", mark: "✗", cls: "c0" },
];
const BY_MARK = Object.fromEntries(RATINGS.map((r) => [r.mark, r.id])) as Record<string, Rating>;
const MARK_OF = Object.fromEntries(RATINGS.map((r) => [r.id, r.mark])) as Record<Rating, string>;

/**
 * The automatic mark out of 20 from an objectives checklist:
 * Yes = full credit, Partly = half, Not yet = none.
 */
export function objectivesTotal(ratings: (Rating | undefined)[]): number {
  if (!ratings.length) return 0;
  const pts = ratings.reduce((a, r) => a + (r === "yes" ? 1 : r === "partly" ? 0.5 : 0), 0);
  return Math.round((pts / ratings.length) * 20);
}

const PREFIX = "Objectives: ";

/**
 * The checklist is saved as the first line of the "what worked" comment, in
 * plain readable text ("Objectives: ✓ States the topic | ◐ …"), so teachers,
 * exports and the AI prompt all see it without a database change.
 */
export function encodeObjectives(checks: [string, Rating][], text: string): string | null {
  const body = text.trim();
  if (!checks.length) return body || null;
  const line = PREFIX + checks.map(([o, r]) => `${MARK_OF[r]} ${o}`).join(" | ");
  return body ? `${line}\n\n${body}` : line;
}

export function decodeObjectives(stored: string | null | undefined): { checks: [string, Rating][]; text: string } {
  const s = stored ?? "";
  if (!s.startsWith(PREFIX)) return { checks: [], text: s };
  const nl = s.indexOf("\n");
  const line = nl === -1 ? s : s.slice(0, nl);
  const text = nl === -1 ? "" : s.slice(nl).trim();
  const checks = line
    .slice(PREFIX.length)
    .split(" | ")
    .map((part): [string, Rating] | null => {
      const mark = part.slice(0, 1);
      const r = BY_MARK[mark];
      return r ? [part.slice(1).trim(), r] : null;
    })
    .filter((x): x is [string, Rating] => !!x);
  return { checks, text };
}
