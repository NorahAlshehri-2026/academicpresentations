"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/app/_lib/types";
import { startPreviewHref, stopPreviewHref } from "@/app/_lib/preview-cookie";

/**
 * Each tab carries its own colour by what it is for (see .sitenav [data-tone]
 * in globals.css):
 *   home      white      the start page
 *   guide     sky blue   help
 *   learn     cyan       reading: units, coursebook, courses
 *   practice  orange     speaking activities
 *   record    violet     my recordings
 *   share     pink       shared with me
 *   assess    yellow     the rubric
 *   teach     periwinkle my classes
 *   media     rose       recorded lectures (staff only)
 *   admin     coral      academy administration
 *   progress  green      my progress (an action item, always filled)
 */
type Tone = "home" | "guide" | "learn" | "practice" | "record" | "share" | "assess" | "teach" | "media" | "admin" | "progress";
type Item = [href: string, label: string, tone: Tone, cta?: boolean];

/**
 * The header links, laid out like the original practice studio:
 * Home · Guide · Units · Coursebook · Activities · Games · My recordings · Shared with me · Rubric · My progress.
 * Staff get the same course pages (as a student preview) plus their own:
 * My classes and Recorded lectures. Recorded lectures is never in the student list,
 * and no student page links to it.
 *
 * Staff also get "Student preview", which switches the whole site to the
 * student tabs and pages until they press "Exit preview" (previewing = true).
 */
export default function SiteNav({
  role,
  isOwner,
  previewing,
}: {
  role: Role | null;
  isOwner?: boolean;
  previewing?: boolean;
}) {
  const path = usePathname() ?? "/";
  const staff = !!role && role !== "student";

  let items: Item[];
  if (!role) {
    items = [["/", "Home", "home"], ["/guide", "Guide", "guide"], ["/courses", "Courses", "learn"], ["/rubric", "Rubric", "assess"]];
  } else if (role === "student" || (staff && previewing)) {
    items = [
      ["/", "Home", "home"],
      ["/guide", "Guide", "guide"],
      ["/units", "Units", "learn"],
      ["/coursebook", "Coursebook", "learn"],
      ["/activities", "Activities", "practice"],
      ["/games", "Games", "practice"],
      ["/recordings", "My recordings", "record"],
      ["/shared", "Shared with me", "share"],
      ["/rubric", "Rubric", "assess"],
      ["/progress", "My progress", "progress", true],
    ];
  } else {
    items = [
      ["/", "Home", "home"],
      ["/guide", "Guide", "guide"],
      ["/units", "Units", "learn"],
      ["/coursebook", "Coursebook", "learn"],
      ["/activities", "Activities", "practice"],
      ["/games", "Games", "practice"],
      ["/teach", "My classes", "teach"],
      ["/videos", "Recorded lectures", "media"],
    ];
    if (role === "admin") items.push(["/admin", isOwner ? "Admin" : "Academy", "admin"]);
    items.push(["/rubric", "Rubric", "assess"]);
  }

  const current = (href: string) =>
    href === "/"
      ? path === "/"
      : path === href ||
        path.startsWith(href + "/") ||
        (href === "/activities" && path.startsWith("/learn/")) ||
        (href === "/shared" && path.startsWith("/review/") && (role === "student" || previewing)) ||
        (href === "/teach" && path.startsWith("/review/") && role !== "student" && !previewing);

  return (
    <nav className="sitenav">
      {items.map(([href, label, tone, cta]) => (
        <Link
          key={href}
          href={href}
          data-tone={tone}
          className={cta ? "cta" : undefined}
          aria-current={current(href) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
      {staff && previewing && (
        <a href={stopPreviewHref(path)} className="pv-exit" title="Back to the teacher view of the site">
          Exit preview
        </a>
      )}
      {staff && !previewing && (
        <a href={startPreviewHref(path)} className="pv-start" title="See the whole site as your students see it">
          Student preview
        </a>
      )}
      {role ? (
        <form action="/auth/signout" method="post">
          <button type="submit" className="cta-out">Sign out</button>
        </form>
      ) : (
        <Link href="/login" className="cta" data-tone="progress">Sign in</Link>
      )}
    </nav>
  );
}
