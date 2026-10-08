import { currentProfile, adminClient } from "@/app/_lib/supabase";
import StaffJoin from "@/app/_components/StaffJoin";

/**
 * A one-time staff invitation link. It must work for someone with no account,
 * so the invitation is looked up with the server key; the page shows only the
 * role it grants and who sent it.
 */
export default async function StaffInvitePage({ params }: { params: { token: string } }) {
  const token = params.token.toLowerCase();
  const profile = await currentProfile().catch(() => null);

  let invite: { role: string; used_by: string | null; used_at: string | null; revoked: boolean; from: string | null } | null = null;
  let lookupFailed = false;
  if (/^[a-f0-9]{32}$/.test(token)) {
    try {
      const { data, error } = await adminClient()
        .from("staff_invites")
        .select("role, used_by, used_at, revoked, sender:profiles!staff_invites_created_by_fkey(full_name)")
        .eq("token", token)
        .maybeSingle();
      if (error) throw error;
      if (data) invite = { ...(data as any), from: (data as any).sender?.full_name ?? null };
    } catch {
      lookupFailed = true;
    }
  }

  if (lookupFailed) {
    return (
      <div className="card narrow" style={{ marginTop: 40 }}>
        <h3>This link cannot be checked right now</h3>
        <p className="small muted">The site is missing the key it needs to create accounts. Please try again later.</p>
      </div>
    );
  }

  if (!invite || invite.revoked || invite.used_by || invite.used_at) {
    return (
      <div className="card narrow" style={{ marginTop: 40 }}>
        <h3>This invitation link does not work</h3>
        <p className="small muted">
          It has already been used, or it was cancelled. Ask the academy owner for a new one.
        </p>
      </div>
    );
  }

  const roleLabel = invite.role === "admin" ? "an administrator" : "a teacher";

  return (
    <div className="card narrow" style={{ marginTop: 24 }}>
      <span className="pill c1">Staff invitation</span>
      <h3 style={{ marginTop: 10, fontSize: 19 }}>Join as {roleLabel}</h3>
      <p className="small muted">
        {invite.from ?? "The academy owner"} has invited you to the Foundations of Academic Presentations academy.
        This link works once.
      </p>
      <StaffJoin
        token={token}
        role={invite.role}
        signedInAs={profile ? { name: profile.full_name, role: profile.role } : null}
      />
    </div>
  );
}
