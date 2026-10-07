import { redirect } from "next/navigation";
import Link from "next/link";
import { currentProfile } from "@/app/_lib/supabase";
import InviteForm from "@/app/_components/InviteForm";

export default async function InvitePage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/admin/invite");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <>
      <div className="card">
        <Link className="btn ghost sm" href="/admin">← Back to the academy</Link>
        <h3 style={{ marginTop: 12 }}>Invite someone</h3>
        <p className="small muted">
          They receive an email with a link that lets them set their own password. Nobody can create an
          account without one.
        </p>
      </div>
      <InviteForm />
    </>
  );
}
