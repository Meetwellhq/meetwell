import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { ViewTracker } from "@/components/profile/tracking";
import { isSupabaseConfigured } from "@/lib/config";
import { getPublicProfile } from "@/lib/profiles/queries";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return { title: "Profile" };
  const profile = await getPublicProfile(slug);
  if (!profile) return { title: "Profile unavailable", robots: { index: false } };

  // Metadata uses public fields only.
  const subtitle = [profile.title, profile.organization].filter(Boolean).join(" · ");
  return {
    title: profile.fullName,
    description: subtitle || `Connect with ${profile.fullName}`,
    robots: { index: false, follow: false },
    openGraph: {
      title: profile.fullName,
      description: subtitle || undefined,
      images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined,
      type: "profile",
    },
  };
}

export default async function PublicProfilePage({ params, searchParams }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const { src } = await searchParams;
  if (!isSupabaseConfigured()) notFound();

  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  return (
    <main className="flex-1 px-4 py-6 sm:py-12">
      <ViewTracker slug={profile.slug} source={src === "qr" ? "qr" : "link"} />
      <ProfileView profile={profile} />
    </main>
  );
}
