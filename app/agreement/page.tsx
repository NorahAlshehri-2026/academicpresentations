import { redirect } from "next/navigation";
import { currentProfile, homeFor, serverClient } from "@/app/_lib/supabase";
import { hasAcceptedTerms, safeNext } from "@/app/_lib/terms";
import { TermsText } from "@/app/_components/TermsText";
import AgreementForm from "@/app/_components/AgreementForm";

export const metadata = { title: "Terms of use · Academic Presentations" };

/**
 * Where a student lands if they have not accepted the current terms of use
 * (middleware.ts sends them here). Nothing in the course opens until they tick
 * the box.
 */
export default async function AgreementPage({ searchParams }: { searchParams?: { next?: string } }) {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/agreement");

  const next = safeNext(searchParams?.next);
  if (profile.role !== "student") redirect(next === "/" ? homeFor(profile.role) : next);

  const {
    data: { user },
  } = await serverClient().auth.getUser();
  if (hasAcceptedTerms(user?.app_metadata)) redirect(next);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="pagehead">
        <h1>Before you start</h1>
        <p className="lead">Please read the terms of use for this website. Tick the box to accept them and open the course.</p>
      </div>
      <div className="card">
        <h3>Terms of use</h3>
        <TermsText />
      </div>
      <div className="card">
        <AgreementForm next={next} />
      </div>
    </div>
  );
}
