import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { currentProfile, homeFor } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Foundations of Academic Presentations",
  description:
    "Learn to plan, structure and deliver academic presentations. Timed practice, peer review and feedback against a marking rubric.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let profile = null;
  try {
    profile = await currentProfile();
  } catch {
    // Supabase not configured yet — the public pages still render
  }

  return (
    <html lang="en">
      <body>
        <header className="sitehead">
          <div className="inner">
            <Link className="brand" href="/">
              <span className="mk">A</span>
              <span>
                <b>Academic Presentations</b>
                <i>Online academy</i>
              </span>
            </Link>
            <nav className="sitenav">
              <Link href="/courses">Courses</Link>
              {profile ? (
                <>
                  <Link href={homeFor(profile.role)} className="cta">
                    {profile.role === "student" ? "My learning" : "Dashboard"}
                  </Link>
                  <form action="/auth/signout" method="post">
                    <button type="submit">Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="cta">
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
      </body>
    </html>
  );
}
