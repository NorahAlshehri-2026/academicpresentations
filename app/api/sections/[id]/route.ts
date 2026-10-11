import { NextResponse } from "next/server";
import { currentProfile, serverClient, adminClient } from "@/app/_lib/supabase";

/**
 * Deletes a class (DELETE-CLASS-2026-10.sql must have been run once).
 *
 * The deletion itself runs through the viewer's own client: delete_section()
 * decides whether this person may delete the class (an administrator: any
 * class; its teacher: only while nothing in it is officially marked) and
 * removes the class and everything in it in one step, or nothing at all.
 *
 * Only afterwards does the server key remove the recording files, because a
 * student's file can be removed only by that student or the service role.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role === "student") return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const { data: files, error } = await serverClient().rpc("delete_section", { sec: params.id });
  if (error) {
    const msg = error.message.includes("delete_section")
      ? "Deleting classes is not switched on yet: run DELETE-CLASS-2026-10.sql in Supabase first."
      : error.message.replace(/^refused:\s*/, "");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // The class is gone. Clear its recordings; a failure here leaves only orphaned files.
  try {
    const storage = adminClient().storage.from("recordings");
    const paths = new Set<string>((files as string[] | null) ?? []);
    // anything else left in the class's folder (e.g. an upload whose attempt was never saved)
    const { data: students } = await storage.list(params.id, { limit: 1000 });
    for (const s of students ?? []) {
      const { data: inside } = await storage.list(`${params.id}/${s.name}`, { limit: 1000 });
      for (const f of inside ?? []) paths.add(`${params.id}/${s.name}/${f.name}`);
    }
    const all = Array.from(paths);
    for (let i = 0; i < all.length; i += 100) await storage.remove(all.slice(i, i + 100));
  } catch (e) {
    console.error("delete section: recordings not cleared", e);
  }

  return NextResponse.json({ ok: true });
}
