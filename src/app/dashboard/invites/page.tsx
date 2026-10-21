import { redirect } from "next/navigation";

/** The admin tools moved to /admin; keep old links working. */
export default function OldInvitesPage() {
  redirect("/admin");
}
