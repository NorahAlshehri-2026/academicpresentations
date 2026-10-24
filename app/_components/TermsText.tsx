import { Fragment } from "react";
import { TERMS, TERMS_SHORT } from "@/app/_lib/terms";

/** "*Passport*" → <i>Passport</i> */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("*").map((part, i) => (i % 2 ? <i key={i}>{part}</i> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

/** The full terms of use, numbered. Used on /agreement and in the Guide. */
export function TermsText() {
  return (
    <ol className="small" style={{ paddingLeft: 20, margin: "8px 0 0" }}>
      {TERMS.map((s) => (
        <li key={s.title} style={{ marginBottom: 12 }}>
          <b>{s.title}</b>
          {s.text && (
            <p style={{ margin: "4px 0 0" }}>
              <Rich text={s.text} />
            </p>
          )}
          {s.points && (
            <ul style={{ paddingLeft: 18, margin: "4px 0 0" }}>
              {s.points.map((p) => (
                <li key={p} style={{ marginBottom: 3 }}>
                  <Rich text={p} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * The tick box a student must check before the account is created or the
 * course opens. The full terms open in a new tab so a half-filled form is
 * not lost.
 */
export function TermsAgree({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      htmlFor={id}
      className="small"
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        marginTop: 16,
        padding: "12px 13px",
        border: "1px solid var(--rule)",
        borderRadius: 10,
        background: "var(--tint)",
        cursor: "pointer",
      }}
    >
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, margin: "2px 0 0", flex: "none", accentColor: "var(--green-btn)" }}
      />
      <span>
        <b>I agree to the terms of use.</b> {TERMS_SHORT}{" "}
        <a href="/guide#terms" target="_blank" rel="noopener">
          Read the full terms
        </a>
      </span>
    </label>
  );
}
