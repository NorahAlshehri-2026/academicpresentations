/**
 * The marking rubric. One definition, used by the peer form, the teacher's
 * mark sheet, the AI feedback prompt and every score display — so a wording
 * change lands everywhere at once.
 *
 * The ids match the keys the database accepts in feedback.scores; adding a
 * criterion here without adding it to the rubric_scores_ok() constraint in
 * schema.sql will have every write rejected.
 */

export type Criterion = {
  id: "intro" | "organization" | "delivery" | "language" | "conclusion";
  n: number;
  name: string;
  l4: string;
  l3: string;
  l2: string;
  l1: string;
};

export const RUBRIC: Criterion[] = [
  {
    id: "intro",
    n: 1,
    name: "Introduction and presentation structure",
    l4: "Engaging opening that captures attention; topic introduced clearly; purpose stated; clear overview of main themes and sub-themes.",
    l3: "Suitable opening that gains some attention; topic clear; purpose stated; overview given, some details limited.",
    l2: "Basic opening that does not fully engage; topic lacks focus; purpose unclear or partial; overview vague.",
    l1: "Opening weak or missing; topic or purpose unclear or not stated; no overview provided.",
  },
  {
    id: "organization",
    n: 2,
    name: "Organization and content development",
    l4: "Ideas logically organized; themes clearly developed and supported; lead-in phrases used effectively; linking expressions transition smoothly; information accurate and sufficiently developed.",
    l3: "Ideas mostly well organized; themes mostly clear and supported; some lead-in phrases; linking with minor inconsistency; information mostly accurate.",
    l2: "Organization sometimes unclear; themes underdeveloped; lead-in and linking limited; information general.",
    l1: "Ideas poorly organized; themes missing or unclear; little or no linking; information inaccurate or irrelevant.",
  },
  {
    id: "delivery",
    n: 3,
    name: "Delivery and audience engagement",
    l4: "Excellent eye contact; appropriate posture and natural gestures; clear projection; suitable pace and effective pauses; clear pronunciation and word stress; engages throughout; minimal reliance on notes.",
    l3: "Good eye contact most of the time; appropriate posture; voice generally clear; pace mostly appropriate; minor pronunciation or stress issues; occasionally looks at notes.",
    l2: "Limited eye contact; inconsistent posture; uneven projection; uneven pace, pauses missing or overused; errors affect clarity; frequently relies on notes.",
    l1: "Little or no eye contact; poor posture; voice too soft or monotone; poor pace; frequent errors; reads almost entirely from notes.",
  },
  {
    id: "language",
    n: 4,
    name: "Academic language and source acknowledgement",
    l4: "Wide range of academic vocabulary; presentation expressions accurate; sources acknowledged accurately and consistently; evidence integrated naturally; grammar consistently accurate.",
    l3: "Appropriate vocabulary with minor limitations; expressions correct with minor errors; most sources acknowledged; evidence generally well integrated.",
    l2: "Limited academic vocabulary; expressions used inconsistently; acknowledgement incomplete; evidence integration weak; frequent grammar errors.",
    l1: "Very limited vocabulary; expressions rarely used; sources not acknowledged; no evidence integration; errors affect clarity.",
  },
  {
    id: "conclusion",
    n: 5,
    name: "Conclusion and professionalism",
    l4: "Summarizes main points clearly; signals the end effectively; thanks the audience; invites questions and responds professionally; finishes within time; confident.",
    l3: "Clear summary; signals the end and thanks the audience; invites questions; minor issues in responding or timing.",
    l2: "Summary brief or incomplete; ending not clearly signalled; questions not invited; timing off; limited confidence.",
    l1: "No summary; ends abruptly; no thanks or invitation; poor time management; lacks confidence.",
  },
];

export const RB = Object.fromEntries(RUBRIC.map((c) => [c.id, c])) as Record<string, Criterion>;

/** A total out of 20 from a set of per-criterion scores out of 4. */
export function totalOf(scores: Record<string, number> | null | undefined) {
  if (!scores) return null;
  const vals = RUBRIC.map((c) => scores[c.id]).filter((v): v is number => typeof v === "number");
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 4)) * 20);
}

export function band(total: number): [string, string] {
  if (total >= 18) return ["Excellent", "var(--green)"];
  if (total >= 15) return ["Good", "var(--ink)"];
  if (total >= 11) return ["Satisfactory", "var(--gold)"];
  return ["Needs improvement", "var(--red)"];
}
