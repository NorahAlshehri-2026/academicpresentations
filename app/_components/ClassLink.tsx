"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/app/_lib/supabase-browser";

/**
 * The share panel for one section: the join link, a copy button, a ready-made
 * announcement to paste into WhatsApp or the LMS, and a switch to stop new
 * students joining once the class has filled.
 *
 * The link is built from window.location.origin, so it is correct on the
 * deployed site and on a custom domain without anything to configure.
 */
export default function ClassLink({
  sectionId,
  code,
  open,
  courseTitle,
  sectionNumber,
  term,
  teacherName,
}: {
  sectionId: string;
  code: string;
  open: boolean;
  courseTitle: string;
  sectionNumber: string;
  term: string;
  teacherName: string;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const url = origin ? `${origin}/join/${code}` : `/join/${code}`;

  const message =
    `${courseTitle}\n` +
    `Section ${sectionNumber} · ${term}\n\n` +
    `Join the class here:\n${url}\n\n` +
    `Open the link on your phone or laptop, enter your name and university email, ` +
    `and choose a password. That sets up your account and puts you in our section.\n\n` +
    `${teacherName}`;

  async function copy(what: "link" | "message") {
    const text = what === "link" ? url : message;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard refused (an insecure context, or permission denied)
      setError("Copying was blocked. Select the text and copy it by hand.");
      return;
    }
    setError(null);
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    const supabase = browserClient();
    const { error: e } = await supabase
      .from("sections")
      .update({ invites_open: !open })
      .eq("id", sectionId);
    setBusy(false);
    if (e) {
      setError("That could not be changed. Reload the page and try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--rule)", paddingTop: 12 }}>
      <div className="spread">
        <h3 style={{ fontSize: 14 }}>Class link</h3>
        <span className="pill" style={open ? undefined : { background: "var(--tint)", color: "var(--muted)" }}>
          {open ? "open to new students" : "closed"}
        </span>
      </div>

      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}
      />

      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn sm" onClick={() => copy("link")}>
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => copy("message")}>
          {copied === "message" ? "Copied" : "Copy announcement"}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          onClick={toggle}
          disabled={busy}
          style={{ marginLeft: "auto" }}
        >
          {busy ? "Saving…" : open ? "Close to new students" : "Reopen"}
        </button>
      </div>

      {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}

      <details style={{ marginTop: 10 }}>
        <summary className="tiny muted" style={{ cursor: "pointer" }}>
          See the announcement text
        </summary>
        <textarea
          readOnly
          value={message}
          rows={9}
          onFocus={(e) => e.currentTarget.select()}
          style={{ marginTop: 8, fontSize: 13 }}
        />
      </details>

      <p className="tiny muted" style={{ marginTop: 8 }}>
        Anyone with this link can join <b>this section</b> while it is open. Close it once your class
        has joined, and reopen it if a latecomer needs to.
      </p>
    </div>
  );
}
