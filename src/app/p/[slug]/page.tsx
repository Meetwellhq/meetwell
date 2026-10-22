import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { ViewTracker } from "@/components/profile/tracking";
import { isSupabaseConfigured } from "@/lib/config";
import { getPublicProfile } from "@/lib/profiles/queries";
import type { Viewer } from "@/components/profile/card-keeper";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const [{ data: offerRows }, user] = await Promise.all([supabase.rpc("mentor_offer", { p_slug: profile.slug }), getCurrentUser()]);
  const offer = ((offerRows ?? []) as { price_kobo: number; first_name: string }[])[0];
  const source = src === "qr" ? "qr" : "link";
  // Logged in: is this their own card? (Only owners can read their own profile row.)
  let viewer: Viewer = "visitor";
  if (user) {
    const { data: own } = await supabase.from("profiles").select("slug").eq("user_id", user.id).maybeSingle();
    viewer = own?.slug === profile.slug ? "owner" : "member";
  }

  return (
    <main className="flex-1 px-4 py-6 sm:py-12">
      <ViewTracker slug={profile.slug} source={source} />
      <ProfileView
        profile={profile}
        offer={offer ? { priceKobo: offer.price_kobo, firstName: offer.first_name } : null}
        viewer={viewer}
        source={source}
      />
    </main>
  );
}
