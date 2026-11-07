import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentProfile } from "@/app/_lib/supabase";
import { PreviewBanner } from "@/app/_components/StudentPreview";
import SymbolSprint from "@/app/_components/SymbolSprint";

export const metadata: Metadata = { title: "Symbol Sprint · Foundations of Academic Presentations" };

/**
 * Games: practice that is not graded. For now one game, Symbol Sprint, with
 * three rounds on the note-taking symbols of Coursebook Unit 5. Nothing here
 * is saved to the database.
 */
export default async function GamesPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/games");

  return (
    <>
      {profile.role !== "student" && <PreviewBanner />}
      <SymbolSprint player={profile.id} />
    </>
  );
}
