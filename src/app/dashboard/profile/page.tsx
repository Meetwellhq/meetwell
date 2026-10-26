import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileStrength } from "@/components/dashboard/profile-strength";
import { ProfileEditor } from "@/components/editor/profile-editor";
import { myCompleteness } from "@/lib/matching/my-completeness";
import { isSparkOn } from "@/lib/spark";
import { getSiteUrl } from "@/lib/config";
import { getOwnProfile } from "@/lib/profiles/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile" };

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");
  // Spark details live on the profile row but outside the card fields.
  const supabase = await createClient();
  // The same score as the "complete your profile" email and the mentor check.
  const completeness = await myCompleteness(supabase, user.id);
  const { data: spark } = await supabase
    .from("profiles")
    .select("field, experience_years")
    .eq("id", profile.id)
    .maybeSingle();

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Profile</h1>
      {completeness && (
        <div className="mb-6">
          <ProfileStrength percent={completeness.percent} items={completeness.items} />
        </div>
      )}
      <ProfileEditor
        spark={await isSparkOn()}
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
