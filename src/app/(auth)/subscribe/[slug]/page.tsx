import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { SubscribeButton } from "@/components/mentors/subscribe-button";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/misc";
import { isMentor } from "@/lib/matching/constants";
import type { ConversationRow } from "@/lib/messaging/types";
import { paymentsEnabled } from "@/lib/payments/paystack";
import { getPublicProfile } from "@/lib/profiles/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Message a mentor", robots: { index: false } };

const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" });

export default async function SubscribePage({ params }: PageProps<"/subscribe/[slug]">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/subscribe/${slug}`)}`);

  const supabase = await createClient();
  const [card, { data: offerRows }, { data: me }, { data: convs }] = await Promise.all([
    getPublicProfile(slug),
    supabase.rpc("mentor_offer", { p_slug: slug }),
    supabase.from("profiles").select("slug, experience_years").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("my_conversations"),
  ]);
  if (!card) notFound();
  const offer = ((offerRows ?? []) as { price_kobo: number; first_name: string }[])[0];
  const first = offer?.first_name || card.fullName.split(" ")[0];
  const existing = ((convs ?? []) as ConversationRow[]).find((c) => c.role === "member" && c.other_slug === card.slug);
  const active = existing && new Date(existing.access_until) > new Date();
  const free = offer?.price_kobo === 0;

  let blocker: React.ReactNode = null;
  if (!offer) blocker = <>{first} isn&apos;t taking new messages right now.</>;
  else if (me?.slug === card.slug) blocker = <>This is your own card.</>;
  else if (me?.experience_years == null)
    blocker = (
      <>
        Add your years of experience first, in{" "}
        <Link href="/dashboard/profile" className="underline">
          Edit card
        </Link>
        .
      </>
    );
  else if (isMentor(me.experience_years)) blocker = <>Messaging mentors is for members earlier in their careers.</>;
  else if (!free && !paymentsEnabled()) blocker = <>Payments open soon. Please check back in a little while.</>;

  return (
    <>
      <AuthIntro title={free ? `Message ${first} for free` : `Message ${first} for 30 days`}>
        Get private messages with someone a step ahead of you, for advice on your work and career.
      </AuthIntro>

      <AuthSection className="flex items-center gap-4">
        <Avatar name={card.fullName} src={card.avatarUrl} className="size-14 shrink-0 text-lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{card.fullName}</p>
          {(card.title || card.organization) && (
            <p className="truncate text-sm text-ink-2">{[card.title, card.organization].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {offer && (
          <p className="ml-auto shrink-0 text-right">
            <span className="block text-xl font-semibold text-ink">{free ? "Free" : naira(offer.price_kobo)}</span>
            <span className="text-xs text-ink-3">for 30 days</span>
          </p>
        )}
      </AuthSection>

      <AuthSection>
        <ul className="flex flex-col gap-2.5 text-[15px] text-ink">
          {(free
            ? [
                `${first} takes messages for free.`,
                `Private messages with ${first} for 30 days, and you can keep going for free after that.`,
                "Be kind and to the point. Our community rules apply.",
              ]
            : [
                `Private messages with ${first} for 30 days.`,
                `If ${first} doesn't reply within 7 days, you get a full refund.`,
                "Nothing renews on its own. We'll remind you before it ends.",
                "Pay with Paystack: card, bank transfer or USSD.",
              ]
          ).map((t) => (
            <li key={t} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </AuthSection>

      <AuthSection className="flex flex-col gap-3">
        {active && existing && (
          <Alert tone="success">
            You can message {first} until {day(existing.access_until)}.{" "}
            <Link href={`/dashboard/messages/${existing.id}`} className="underline">
              Open the conversation
            </Link>
            . {free ? "Starting again adds 30 more days." : "Paying again adds 30 more days."}
          </Alert>
        )}
        {blocker ? (
          <Alert>{blocker}</Alert>
        ) : (
          <SubscribeButton
            slug={card.slug}
            free={free}
            label={free ? (active ? "Add 30 more days" : `Start messaging ${first}`) : active ? `Add 30 days for ${naira(offer!.price_kobo)}` : `Pay ${naira(offer!.price_kobo)}`}
          />
        )}
        <p className="text-center text-xs text-ink-3">
          {free ? "By messaging" : "By paying"} you agree to our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/community-rules" className="underline">
            community rules
          </Link>
          .{!free && " We never see your card details."}
        </p>
      </AuthSection>
    </>
  );
}
