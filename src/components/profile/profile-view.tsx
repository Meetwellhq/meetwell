import Link from "next/link";
import { ArrowUpRight, Globe, Mail, MessageSquare, Phone, UserRoundPlus } from "lucide-react";
import { SocialIcon } from "@/components/icons/social-icon";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { goalLabel, socialLabel } from "@/lib/profiles/constants";
import { contactActions, displayUrl, type ContactAction } from "@/lib/profiles/links";
import type { PublicProfile } from "@/lib/profiles/types";
import { ConversationStarter } from "./conversation-starter";
import { TrackedLink } from "./tracking";

const ACTION_ICON: Record<ContactAction["kind"], React.ReactNode> = {
  email: <Mail className="size-5" aria-hidden />,
  phone: <Phone className="size-5" aria-hidden />,
  sms: <MessageSquare className="size-5" aria-hidden />,
  whatsapp: <SocialIcon platform="whatsapp" />,
  website: <Globe className="size-5" aria-hidden />,
};

type Props = {
  profile: PublicProfile;
  /** In preview, links still render but analytics and vCard download are off. */
  preview?: boolean;
};

/**
 * The visitor-facing card. Receives only the public projection of a profile,
 * so private fields cannot leak into the rendered HTML.
 */
export function ProfileView({ profile, preview = false }: Props) {
  const slug = preview ? null : profile.slug;
  const allActions = contactActions(profile);
  // Email sits at the top of the links list; calls, texts and the website stay as quick actions.
  const emailActions = allActions.filter((a) => a.kind === "email");
  const actions = allActions.filter((a) => a.kind !== "email");
  const email = profile.contacts.find((c) => c.type === "email")?.value ?? null;
  const subtitle = [profile.title, profile.organization].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface px-5 pb-5 pt-7 text-center">
        <Avatar name={profile.fullName} src={profile.avatarUrl} className="mx-auto size-24 text-2xl" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{profile.fullName}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p>}
        {profile.bio && <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-2">{profile.bio}</p>}

        {profile.networkingGoals.length > 0 && (
          <div className="mt-4">
            <p className="sr-only">Open to</p>
            <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Open to">
              {profile.networkingGoals.map((g) => (
                <li key={g} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                  Open to {goalLabel(g).toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6">
          {preview ? (
            <span className={buttonClass({ size: "lg", className: "w-full cursor-default" })} aria-disabled>
              <UserRoundPlus className="size-5" aria-hidden />
              Save contact
            </span>
          ) : (
            <TrackedLink
              slug={slug}
              event="save_contact"
              href={`/p/${profile.slug}/vcard`}
              download
              className={buttonClass({ size: "lg", className: "w-full" })}
            >
              <UserRoundPlus className="size-5" aria-hidden />
              Save contact
            </TrackedLink>
          )}
        </div>

        {actions.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-2 text-left">
            {actions.map((a) => (
              <li key={a.key} className={actions.length % 2 === 1 && a === actions[actions.length - 1] ? "col-span-2" : ""}>
                <TrackedLink
                  slug={slug}
                  event={a.event}
                  href={a.href}
                  {...(a.kind === "website" || a.kind === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex h-full items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
                  aria-label={`${a.label}: ${a.detail}`}
                >
                  <span className="text-ink-2">{ACTION_ICON[a.kind]}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block truncate text-xs text-ink-3">{a.detail}</span>
                  </span>
                </TrackedLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(emailActions.length > 0 || profile.socials.length > 0) && (
        <section aria-labelledby="socials-title" className="rounded-2xl border border-border bg-surface p-2">
          <h2 id="socials-title" className="sr-only">
            Email and social profiles
          </h2>
          <ul className="divide-y divide-border">
            {emailActions.map((a) => (
              <li key={a.key}>
                <TrackedLink
                  slug={slug}
                  event={a.event}
                  href={a.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink">
                    <Mail className="size-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{a.label}</span>
                    <span className="block truncate text-xs text-ink-3">{a.detail}</span>
                  </span>
                  <ArrowUpRight className="size-4 text-ink-3" aria-hidden />
                </TrackedLink>
              </li>
            ))}
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
          networkingGoals: profile.networkingGoals,
        }}
        email={email}
        slug={slug}
      />

      <p className="py-4 text-center text-xs text-ink-3">
        {preview ? (
          <>Preview — this is what visitors see.</>
        ) : (
          <>
            Shared with{" "}
            <Link href="/" className="font-medium text-ink-2 underline-offset-2 hover:underline">
              {APP_NAME}
            </Link>{" "}
            · <Link href="/sign-up" className="underline-offset-2 hover:underline">Create your own card</Link>
          </>
        )}
      </p>
    </div>
  );
}
