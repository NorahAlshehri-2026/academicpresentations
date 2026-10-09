"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/app/_lib/types";

type Item = [href: string, label: string, cta?: boolean];

/**
 * The header links, laid out like the original practice studio:
 * Home · Units · Activities · My recordings · Shared with me · Rubric · Guide · My progress.
 * Staff get the same course pages (as a student preview) plus their own.
 */
export default function SiteNav({ role, isOwner }: { role: Role | null; isOwner?: boolean }) {
  const path = usePathname() ?? "/";

  let items: Item[];
  if (!role) {
    items = [["/", "Home"], ["/courses", "Courses"], ["/rubric", "Rubric"], ["/guide", "Guide"]];
  } else if (role === "student") {
    items = [
      ["/", "Home"],
      ["/units", "Units"],
      ["/activities", "Activities"],
      ["/recordings", "My recordings"],
      ["/shared", "Shared with me"],
      ["/rubric", "Rubric"],
      ["/guide", "Guide"],
      ["/progress", "My progress", true],
    ];
  } else {
    items = [["/", "Home"], ["/units", "Units"], ["/activities", "Activities"], ["/teach", "My classes"]];
    if (role === "admin") items.push(["/admin", isOwner ? "Admin" : "Academy"]);
    items.push(["/rubric", "Rubric"], ["/guide", "Guide"]);
  }

  const current = (href: string) =>
    href === "/"
      ? path === "/"
      : path === href ||
        path.startsWith(href + "/") ||
        (href === "/activities" && path.startsWith("/learn/")) ||
        (href === "/shared" && path.startsWith("/review/") && role === "student") ||
        (href === "/teach" && path.startsWith("/review/") && role !== "student");

  return (
    <nav className="sitenav">
      {items.map(([href, label, cta]) => (
        <Link key={href} href={href} className={cta ? "cta" : undefined} aria-current={current(href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
      {role ? (
        <form action="/auth/signout" method="post">
          <button type="submit" className={role === "student" ? undefined : "cta-out"}>Sign out</button>
        </form>
      ) : (
        <Link href="/login" className="cta">Sign in</Link>
      )}
    </nav>
  );
}
