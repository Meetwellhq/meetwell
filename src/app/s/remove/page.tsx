import type { Metadata } from "next";
import { RemoveSpeakerCard } from "@/components/profile/remove-speaker-card";

export const metadata: Metadata = { title: "Remove your speaker card", robots: { index: false } };

/** The link in a speaker card email: remove the card in one click (after a confirm). */
export default async function RemoveSpeakerCardPage({ searchParams }: PageProps<"/s/remove">) {
  const { t } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Remove your speaker card</h1>
      <p className="text-[15px] text-ink-2">
        An event organiser added this card for you. Removing it takes it off Meetwell and the event page straight away. You can
        still create your own card later if you want to.
      </p>
      <RemoveSpeakerCard token={typeof t === "string" ? t.slice(0, 64) : ""} />
    </main>
  );
}
