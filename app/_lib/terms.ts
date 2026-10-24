/**
 * The website's terms of use.
 *
 * Students accept them when they create their account (class link or the
 * teacher's email link). A student who has not accepted the current version
 * is sent to /agreement before they can open any course page (see
 * middleware.ts). Teachers and administrators are not asked.
 *
 * Acceptance is kept in the account's app_metadata as { terms: { v, at } },
 * which only the server can write.
 *
 * Change TERMS_VERSION when the wording changes in a way students must accept
 * again; everyone is then asked once more on their next visit.
 *
 * No React or server-only imports here: middleware.ts reads this file.
 */

export const TERMS_VERSION = "2026-10-24";

/** The statement next to the tick box. */
export const TERMS_SHORT =
  "I will not enter or say my student ID or national ID/Iqama number on this website. My recordings and feedback " +
  "will be my own, professional and respectful, and I will use the website and its materials only for this course, " +
  "in line with academic integrity.";

/** *text* is shown in italics. */
export type TermsSection = { title: string; text?: string; points?: string[] };

export const TERMS: TermsSection[] = [
  {
    title: "Educational use only",
    text:
      "This website and its materials are free and non-commercial. They are for students enrolled in this course and " +
      "their teachers. The coursebook is adapted from published sources, including Bell, D. (2008), *Passport to " +
      "Academic Presentations* (Garnet Education). Copyright in all texts, audio, images and videos stays with their " +
      "authors and publishers (see References, p. 59).",
  },
  {
    title: "Protect your personal information",
    points: [
      "Do not enter your student ID number or your national ID / Iqama number anywhere on the website. That includes your name, recordings, file names, comments and feedback.",
      "Do not say these numbers, or any other private details, in your recordings.",
      "Use your real name only, as it appears on your class list. Never share your password.",
    ],
  },
  {
    title: "Academic ethics and integrity",
    points: [
      "Use the website for course work only, following the university's standards of academic integrity.",
      "Every presentation you record must be your own work. Acknowledge every source you use, as practised in Unit 3.",
      "Do not submit another person's recording, or a script written for you, as your own. Use AI tools only when your teacher allows it.",
      "Do not download, copy or share classmates' recordings, or the course materials, outside this course.",
    ],
  },
  {
    title: "Professional recordings",
    text: "All audio and video recordings must reflect professional, academic use:",
    points: [
      "Record in a quiet, suitable setting, and dress appropriately if you use video.",
      "Keep the content relevant to the task and respectful. Nothing offensive, political or personal.",
      "Do not record other people without their permission.",
    ],
  },
  {
    title: "Professional feedback",
    text: "Feedback to classmates must be respectful, honest and constructive:",
    points: [
      "Comment on the presentation, not the person.",
      "Use the rubric and the lesson objectives. Name one strength and one thing to improve.",
      "No offensive, mocking or personal remarks.",
    ],
  },
  {
    title: "AI feedback",
    text: "AI feedback is a practice aid and can be wrong. Your teacher's mark is the official grade.",
  },
  {
    title: "Your recordings",
    text:
      "You, your teacher, and any classmate you choose to share a recording with can see it. Recordings are kept for " +
      "one year and then deleted.",
  },
  {
    title: "Misuse",
    text:
      "Misuse of the website or its content may be reported to your teacher. It will be handled under the " +
      "university's academic integrity regulations.",
  },
];

export type TermsRecord = { v: string; at: string };

/** A fresh acceptance record, to store in app_metadata.terms. */
export const termsRecord = (): TermsRecord => ({ v: TERMS_VERSION, at: new Date().toISOString() });

/** Has this account accepted the current terms? Pass the user's app_metadata. */
export const hasAcceptedTerms = (appMetadata: unknown): boolean =>
  (appMetadata as { terms?: { v?: unknown } } | null | undefined)?.terms?.v === TERMS_VERSION;

/** A same-site path to return to after accepting, or "/" */
export function safeNext(next: unknown): string {
  const s = typeof next === "string" ? next : "";
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.startsWith("/agreement")) return "/";
  return s.slice(0, 500);
}
