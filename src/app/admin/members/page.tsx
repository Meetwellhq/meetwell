import { redirect } from "next/navigation";

/** Renamed to Users; keep old links working. */
export default function OldMembersPage() {
  redirect("/admin/users");
}
