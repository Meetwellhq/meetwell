import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { isSupabaseConfigured } from "@/lib/config";
import { getSpeakerCard } from "@/lib/speaker-cards-queries";

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = isSupabaseConfigured() ? await getSpeakerCard(slug) : null;
  if (!found) return { title: "Card unavailable", robots: { index: false } };
  const subtitle = [found.profile.title, found.profile.organization].filter(Boolean).join(" · ");
  return {
    title: found.profile.fullName,
    description: subtitle || `Speaker at ${found.event.name}`,
    robots: { index: false, follow: false },
  };
}

/** A speaker card a partner added from their spreadsheet: no account behind it. */
export default async function SpeakerCardPage({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) notFound();
  const found = await getSpeakerCard(slug);
  if (!found) notFound();
  return (
    <main className="flex-1 px-4 py-6 sm:py-12">
      <ProfileView profile={found.profile} speakerCard={{ eventSlug: found.event.slug, eventName: found.event.name, partnerName: found.event.partnerName }} />
    </main>
  );
}
