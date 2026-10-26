import { redirect } from "next/navigation";

/** The QR code now lives on the Overview; old links (emails, bookmarks) land there. */
export default function QrPage() {
  redirect("/dashboard");
}
