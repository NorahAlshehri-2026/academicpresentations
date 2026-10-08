"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/app/_lib/types";

type Item = [href: string, label: string];

/** The header links, which differ by role, with the current page highlighted. */
export default function SiteNav({ role, isOwner }: { role: Role | null; isOwner?: boolean }) {
  const path = usePathname() ?? "/";

  let items: Item[];
  if (!role) {
    items = [["/courses", "Courses"], ["/rubric", "Rubric"], ["/guide", "Guide"]];
  } else if (role === "student") {
    items = [
      ["/dashboard", "My learning"],
      ["/shared", "Shared with me"],
      ["/progress", "My progress"],
      ["/rubric", "Rubric"],
      ["/guide", "Guide"],
    ];
  } else {
    items = [["/teach", "My classes"]];
    if (role === "admin") items.push(["/admin", isOwner ? "Admin" : "Academy"]);
    items.push(["/courses", "Courses"], ["/rubric", "Rubric"], ["/guide", "Guide"]);
  }

  const current = (href: string) =>
    path === href || (href !== "/" && path.startsWith(href + "/")) ||
    (href === "/dashboard" && path.startsWith("/learn/")) ||
    (href === "/shared" && path.startsWith("/review/") && role === "student") ||
    (href === "/teach" && path.startsWith("/review/") && role !== "student");

  return (
    <nav className="sitenav">
      {items.map(([href, label]) => (
        <Link key={href} href={href} aria-current={current(href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
      {role ? (
        <form action="/auth/signout" method="post">
          <button type="submit" className="cta-out">Sign out</button>
        </form>
      ) : (
        <Link href="/login" className="cta">Sign in</Link>
      )}
    </nav>
  );
}
