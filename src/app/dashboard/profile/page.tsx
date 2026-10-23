import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/editor/profile-editor";
import { getSiteUrl } from "@/lib/config";
import { getOwnProfile } from "@/lib/profiles/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit card" };

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");
  // Spark details live on the profile row but outside the card fields.
  const { data: spark } = await (await createClient())
    .from("profiles")
    .select("field, experience_years")
    .eq("id", profile.id)
    .maybeSingle();

  return (
    <>
      {/* Phones hide the bottom bar here (the Save bar takes its place), so give a way back. */}
      <Link href="/dashboard/me" className="mb-3 flex items-center gap-1 text-sm text-ink-2 hover:text-ink lg:hidden">
        <ChevronLeft className="size-4" aria-hidden /> Profile
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit your card</h1>
      <ProfileEditor
        // Remount after a save so the form reflects the server-normalised values.
        key={profile.updatedAt}
        mode="edit"
        initial={profile}
        userId={user.id}
        email={user.email}
        siteHost={getSiteUrl().replace(/^https?:\/\//, "")}
        initialExperience={{ field: spark?.field ?? "", experienceYears: spark?.experience_years?.toString() ?? "" }}
      />
    </>
  );
}
