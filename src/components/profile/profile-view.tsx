import Link from "next/link";
import { ArrowUpRight, Globe, Mail, MessageCircle, Phone, UserRoundPlus } from "lucide-react";
import { SocialIcon } from "@/components/icons/social-icon";
import { CompanyAvatar } from "./company-avatar";
import { buttonClass } from "@/components/ui/button";
import { LogoMark } from "@/components/marketing/logo";
import { cn } from "@/lib/cn";
import { APP_NAME, SIGNUPS_OPEN } from "@/lib/config";
import { goalLabel, isOfferedGoal, socialLabel } from "@/lib/profiles/constants";
import { contactActions, displayUrl, type ContactAction } from "@/lib/profiles/links";
import type { PublicProfile } from "@/lib/profiles/types";
import { ConversationStarter } from "./conversation-starter";
import { SaveContactButton } from "./save-contact-button";
import { TrackedLink } from "./tracking";

const ACTION_ICON: Partial<Record<ContactAction["kind"], React.ReactNode>> = {
  email: <Mail className="size-5" aria-hidden />,
  phone: <Phone className="size-5" aria-hidden />,
  whatsapp: <SocialIcon platform="whatsapp" />,
  website: <Globe className="size-5" aria-hidden />,
};

type Props = {
  profile: PublicProfile;
  /** In preview, links still render but analytics and vCard download are off. */
  preview?: boolean;
  /** Set when this person is an approved mentor taking paid messages. */
  offer?: { priceKobo: number; firstName: string } | null;
};

const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);

/**
 * The visitor-facing card. Receives only the public projection of a profile,
 * so private fields cannot leak into the rendered HTML.
 */
export function ProfileView({ profile, preview = false, offer = null }: Props) {
  const slug = preview ? null : profile.slug;
  const allActions = contactActions(profile);
  // Icon-only quick actions under Save contact: email, WhatsApp, call, website.
  const ORDER: ContactAction["kind"][] = ["email", "whatsapp", "phone", "website"];
  const actions = allActions
    .filter((a) => a.kind !== "sms")
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const email = profile.contacts.find((c) => c.type === "email")?.value ?? null;
  // One networking goal per card (older cards may have saved several; show the first).
  const goal = profile.networkingGoals.find(isOfferedGoal) ?? null;
  const subtitle = [profile.title, profile.organization].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface px-5 pb-5 pt-7 text-center">
        <CompanyAvatar name={profile.fullName} src={profile.avatarUrl} organization={profile.organization} className="size-24 text-2xl" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{profile.fullName}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p>}
        {profile.bio && <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-2">{profile.bio}</p>}

        {goal && (
          <p className="mt-4">
            <span className="inline-block rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
              Open to {goalLabel(goal).toLowerCase()}
            </span>
          </p>
        )}

        <div className="mt-6">
          {preview ? (
            <span className={buttonClass({ size: "lg", className: "w-full cursor-default" })} aria-disabled>
              <UserRoundPlus className="size-5" aria-hidden />
              Save contact
            </span>
          ) : (
            <SaveContactButton profile={profile} />
          )}
          {offer && !preview && (
            <Link
              href={`/subscribe/${profile.slug}`}
              className={buttonClass({ variant: "secondary", size: "lg", className: "mt-3 w-full" })}
            >
              <MessageCircle className="size-5" aria-hidden />
              Message {offer.firstName} · {naira(offer.priceKobo)}/month
            </Link>
          )}
        </div>

        {actions.length > 0 && (
          <ul className="mt-4 flex flex-wrap justify-center gap-3" aria-label="Contact">
            {actions.map((a) => (
              <li key={a.key}>
                <TrackedLink
                  slug={slug}
                  event={a.event}
                  href={a.href}
                  {...(a.kind === "website" || a.kind === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="grid size-12 place-items-center rounded-full border border-border bg-surface text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
                  aria-label={`${a.label}: ${a.detail}`}
                  title={`${a.label}: ${a.detail}`}
                >
                  {ACTION_ICON[a.kind]}
                </TrackedLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile.socials.length > 0 && (
        <section aria-labelledby="socials-title" className="rounded-2xl border border-border bg-surface p-2">
          <h2 id="socials-title" className="sr-only">
            Social profiles
          </h2>
          <ul className="divide-y divide-border">
            {profile.socials.map((s, i) => (
              <li key={`${s.platform}-${i}`}>
                <TrackedLink
                  slug={slug}
                  event="social_click"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink">
                    <SocialIcon platform={s.platform} className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{socialLabel(s.platform)}</span>
                    <span className="block truncate text-xs text-ink-3">{displayUrl(s.url)}</span>
                  </span>
                  <ArrowUpRight className="size-4 text-ink-3" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </TrackedLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConversationStarter
        profile={{
          fullName: profile.fullName,
          title: profile.title,
          organization: profile.organization,
          networkingGoals: goal ? [goal] : [],
        }}
        email={email}
        slug={slug}
      />

      {preview ? (
        <>
          <div className={CREATE_BAR} aria-hidden>
            <CreateBarContent />
          </div>
          <p className="pb-4 text-center text-xs text-ink-3">Preview — this is what visitors see.</p>
        </>
      ) : (
        // Floats at the bottom of the screen while visitors scroll the card.
        <Link href={CREATE_HREF} className={cn(CREATE_BAR, "sticky bottom-4 mb-4 transition-colors hover:bg-accent-hover")}>
          <CreateBarContent />
        </Link>
      )}
    </div>
  );
}

// During the private beta, the log-in page offers access codes and early access.
const CREATE_HREF = SIGNUPS_OPEN ? "/sign-up" : "/sign-in";
const CREATE_BAR =
  "flex h-12 items-center justify-between rounded-[6px] bg-accent px-4 text-white shadow-[0_4px_12px_-6px_rgb(0_0_0/0.25)]";

function CreateBarContent() {
  return (
    <>
      <span className="flex items-center gap-2 text-[15px] font-semibold">
        <LogoMark inverted className="size-5" />
        {APP_NAME}
      </span>
      <span className="text-[13px] font-medium">Try it for free</span>
    </>
  );
}
