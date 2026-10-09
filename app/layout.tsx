import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { currentProfile, serverClient } from "@/app/_lib/supabase";
import SiteNav from "@/app/_components/SiteNav";

/**
 * Every page reads the database, and what it reads changes as you teach:
 * courses are published, students enrol, marks are entered. Rendering these
 * pages once and serving the result afterwards would show yesterday's state.
 * This applies to every route in the site.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Foundations of Academic Presentations",
  description:
    "Learn to plan, structure and deliver academic presentations. Timed practice, peer review and feedback against a marking rubric.",
};

const ROLE_LABEL = { student: "Student", teacher: "Teacher", admin: "Administrator" } as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let profile = null;
  let isOwner = false;
  try {
    profile = await currentProfile();
    if (profile?.role === "admin") {
      const { data } = await serverClient().rpc("is_owner");
      isOwner = data === true;
    }
  } catch {
    // Supabase not configured yet — the public pages still render
  }

  return (
    <html lang="en">
      <body>
        <header className="sitehead">
          <div className="inner">
            <Link className="brand" href="/">
              <span className="mk">P</span>
              <span>
                <b>Academic Presentations</b>
                <i>
                  {profile
                    ? `${profile.full_name} · ${isOwner ? "Academy owner" : ROLE_LABEL[profile.role]}`
                    : "Online academy"}
                </i>
              </span>
            </Link>
            <SiteNav role={profile?.role ?? null} isOwner={isOwner} />
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer className="sitefoot">
          Foundations of Academic Presentations
          <br />
          <span className="tiny">
            Recordings are private: only you, your teacher and the classmates you share with can play them.
          </span>
        </footer>
      </body>
    </html>
  );
}
