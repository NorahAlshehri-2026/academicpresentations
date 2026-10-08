import { redirect } from "next/navigation";

/** Invitations are now one-time links made on the Admin page. */
export default function InvitePage() {
  redirect("/admin");
}
