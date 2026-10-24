/**
 * The coursebook is the printed workbook shown page by page. Its files (page
 * images, audio tracks, the PDF and manifest.json) live in the private "media"
 * bucket, never in this repository:
 *
 *   media/<course_id>/coursebook/v<yyyymmdd-hhmmss>/manifest.json
 *   media/<course_id>/coursebook/v<...>/pages/p-01.webp …
 *   media/<course_id>/coursebook/v<...>/audio/track-01.mp3 …
 *   media/<course_id>/coursebook/v<...>/workbook.pdf
 *
 * Each upload is a new version folder; the newest complete one is shown.
 * Boxes are fractions of the page: [left, top, width, height].
 */
export type CbBox = [number, number, number, number];

export type CbPage = {
  n: number;
  img: string;
  w: number;
  h: number;
  /** gold Track labels printed on the page */
  tracks: { t: number; box: CbBox }[];
  /** printed cross-references (contents, "p. 41") */
  links: { page: number; box: CbBox }[];
  /** web addresses printed on the page */
  ext: { href: string; box: CbBox }[];
  /** the page's words, for screen readers */
  text: string;
};

export type CbTrack = { unit: number; ex: string; desc: string; page: number | null; src: string };

export type CbManifest = {
  version: number;
  title: string;
  pages: CbPage[];
  tracks: Record<string, CbTrack>;
  units: Record<string, number | null>;
  anchors: Record<string, number>;
  jumps: { contents: number; tracks: number | null; refs: number | null };
  pdf: string;
};

/** All the files a manifest needs, as paths inside its version folder. */
export function manifestFiles(m: CbManifest): string[] {
  return [...m.pages.map((p) => p.img), ...Object.values(m.tracks).map((t) => t.src), m.pdf];
}

/** "v20261023-121530" → a Date (UTC), or null */
export function versionDate(v: string): Date | null {
  const x = /^v(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(v);
  return x ? new Date(Date.UTC(+x[1], +x[2] - 1, +x[3], +x[4], +x[5], +x[6])) : null;
}

/**
 * The answer key: one entry per exercise, shown to teachers and administrators
 * only, behind a button beside the exercise number. `box` is where the printed
 * exercise number sits on the page. **text** in an answer is shown in bold.
 */
export type CbAnswer = { page: number; ex: string; box: CbBox; answer: string };
export type CbAnswerKey = { version: 1; updated: string; items: CbAnswer[] };
