import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "@/components/auth/join-form";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { Avatar } from "@/components/ui/avatar";
import { getPublicProfile } from "@/lib/profiles/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join Meetwell", robots: { index: false } };

/**
 * Sign-up for someone who opened a member's card. During the private beta the
 * card counts as their invite (20 people per card); otherwise they're sent to
 * the access code and early access options.
 */
export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const { via, partner } = await searchParams;
  if (typeof partner === "string" && partner) return <PartnerJoin slug={partner.toLowerCase().slice(0, 64)} />;
  const slug = typeof via === "string" ? via.toLowerCase().slice(0, 64) : "";
  const [profile, { data: open }] = slug
    ? await Promise.all([getPublicProfile(slug), (await createClient()).rpc("card_invite_open", { p_slug: slug })])
    : [null, { data: false }];
  const firstName = profile?.fullName.split(/\s+/)[0];

  if (!profile || open !== true) {
    return (
      <>
        <AuthIntro title="Join Meetwell">
          {profile ? `${firstName}'s card can't invite more people right now.` : "Meetwell is invite-only for now."} Use an
          access code if you have one, or request early access.
        </AuthIntro>
        <AuthSection className="flex flex-col gap-2 text-center text-sm">
          <Link href="/access-code" className="font-medium text-accent hover:underline">I have an access code</Link>
          <Link href="/early-access" className="font-medium text-accent hover:underline">Request early access</Link>
        </AuthSection>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-center">
        <Avatar name={profile.fullName} src={profile.avatarUrl} className="size-14 text-base" />
      </div>
      <AuthIntro title={`${firstName} invited you to Meetwell`}>
        Create your free card to keep {firstName}&apos;s contact and share yours back. No access code needed.
      </AuthIntro>
      <AuthSection>
        <JoinForm viaCard={profile.slug} />
        <p className="mt-4 text-center text-xs text-ink-3">
          By creating an account you agree to our <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy notice</Link>.
        </p>
      </AuthSection>
      <AuthSection className="text-center text-sm text-ink-2">
        Have an account?{" "}
        <Link href={`/sign-in?method=email&next=${encodeURIComponent(`/p/${profile.slug}`)}`} className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </AuthSection>
    </>
  );
}

/**
 * Sign-up through a partner's link (an event platform such as ThinkUX). The
 * link works as an invite, and the partner can see that this person joined
 * through them, with their public card.
 */
async function PartnerJoin({ slug }: { slug: string }) {
  const { data: name } = await (await createClient()).rpc("partner_invite_name", { p_slug: slug });

  if (!name) {
    return (
      <>
        <AuthIntro title="Join Meetwell">
          This invite link isn&apos;t open right now. Use an access code if you have one, or request early access.
        </AuthIntro>
        <AuthSection className="flex flex-col gap-2 text-center text-sm">
          <Link href="/access-code" className="font-medium text-accent hover:underline">I have an access code</Link>
          <Link href="/early-access" className="font-medium text-accent hover:underline">Request early access</Link>
        </AuthSection>
      </>
    );
  }

  return (
    <>
      <AuthIntro title={`${name} invited you to Meetwell`}>
        Create your free networking card with its own QR code. No access code needed.
      </AuthIntro>
      <AuthSection>
        <JoinForm viaPartner={slug} />
        <p className="mt-4 text-center text-xs text-ink-3">
          {name} will see that you joined through them, and your public card. By creating an account you agree to our{" "}
          <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy notice</Link>.
        </p>
      </AuthSection>
      <AuthSection className="text-center text-sm text-ink-2">
        Have an account?{" "}
        <Link href="/sign-in?method=email" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </AuthSection>
    </>
  );
}
