"use client";

import { usePathname } from "next/navigation";
import { stopPreviewHref } from "@/app/_lib/preview-cookie";

/** The gold strip under the header while a teacher or administrator is in student preview. */
export default function PreviewBar() {
  const path = usePathname() ?? "/";
  return (
    <div className="pv-bar" role="status">
      <div className="pv-inner">
        <span className="pv-eye" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
        <span className="pv-text">
          <b>Student preview.</b> You are seeing the academy as a student does. Recorded lectures and the answer key are
          hidden, and sample details fill in where a student&rsquo;s own would be.
        </span>
        <a className="pv-bar-exit" href={stopPreviewHref(path)}>Exit preview</a>
      </div>
    </div>
  );
}

/** "See the whole site as a student" from the page you are on (for staff outside the preview). */
export function PreviewLink({ children, className }: { children: React.ReactNode; className?: string }) {
  const path = usePathname() ?? "/";
  return (
    <a className={className} href={`/preview?to=on&next=${encodeURIComponent(path)}`}>
      {children}
    </a>
  );
}
