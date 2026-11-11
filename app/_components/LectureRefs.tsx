import { refParts, sortRefs } from "@/app/_lib/staff-video-types";

/**
 * A recorded lecture's references, at the bottom of the lecture, set out as
 * an APA 7th edition reference list: alphabetical, hanging indent, journal
 * names and volumes in italics, DOIs as links.
 */
export default function LectureRefs({ refs, id }: { refs?: string[]; id: string }) {
  if (!refs?.length) return null;
  return (
    <div className="sv-refs" aria-labelledby={`refs-${id}`}>
      <h5 id={`refs-${id}`}>References</h5>
      <ul>
        {sortRefs(refs).map((r, i) => (
          <li key={i}>
            {refParts(r).map((p, j) =>
              p.href ? (
                <a key={j} href={p.href} target="_blank" rel="noopener noreferrer">
                  {p.text}
                </a>
              ) : p.italic ? (
                <i key={j}>{p.text}</i>
              ) : (
                <span key={j}>{p.text}</span>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The help line under a References box. */
export const REFS_HINT =
  "One reference per line, in APA 7th edition style. Put *asterisks* around the journal name and the volume to show them in italics, e.g. *Climate Policy*, *25*(4), 612–630. They are listed in alphabetical order.";
