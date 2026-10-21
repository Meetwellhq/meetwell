"use client";

import { Check, Lock, Trash2 } from "lucide-react";
import { useState } from "react";
import { SocialIcon } from "@/components/icons/social-icon";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { checkSlugAvailability } from "@/lib/profiles/actions";
import { LIMITS, NETWORKING_GOALS, SOCIAL_PLATFORMS } from "@/lib/profiles/constants";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/validation";
import { COMPANIES, TITLE_GROUPS } from "@/lib/profiles/careers";
import { AvatarUpload } from "./avatar-upload";
import { PickOrType } from "./pick-or-type";
import type { SectionProps } from "./types";

export function BasicsSection({
  values,
  errors,
  set,
  userId,
  slugLocked,
  siteHost,
}: SectionProps & { userId: string; slugLocked: boolean; siteHost: string }) {
  const [slugTouched, setSlugTouched] = useState(!!values.slug);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [slugMessage, setSlugMessage] = useState<string | null>(null);

  async function checkSlug(slug: string) {
    if (slugLocked || !slug) return;
    setSlugStatus("checking");
    const res = await checkSlugAvailability(slug);
    setSlugStatus(res.available ? "available" : "taken");
    setSlugMessage(res.available ? null : (res.error ?? "Already taken — try another"));
  }

  return (
    <div className="flex flex-col gap-5">
      <AvatarUpload
        userId={userId}
        name={values.fullName}
        value={values.avatarUrl}
        onChange={(url) => set("avatarUrl", url)}
        error={errors.avatarUrl}
      />
      <Field label="Full name" error={errors.fullName}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={values.fullName}
            maxLength={LIMITS.fullName}
            autoComplete="name"
            onChange={(e) => {
              set("fullName", e.target.value);
              if (!slugTouched && !slugLocked) set("slug", slugify(e.target.value));
            }}
            onBlur={() => !slugTouched && checkSlug(values.slug)}
          />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Professional title" optional error={errors.title}>
          {({ id, describedBy, invalid }) => (
            <PickOrType
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              value={values.title}
              onChange={(v) => set("title", v)}
              groups={TITLE_GROUPS.map((g) => ({ label: g.label, options: g.titles }))}
              maxLength={LIMITS.title}
              placeholder="Type your title"
              otherLabel="Other (type your own)"
              autoComplete="organization-title"
            />
          )}
        </Field>
        <Field label="Company, organization or school" optional error={errors.organization}>
          {({ id, describedBy, invalid }) => (
            <PickOrType
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              value={values.organization}
              onChange={(v) => set("organization", v)}
              groups={[{ label: "Companies", options: COMPANIES.map((c) => c.name) }]}
              maxLength={LIMITS.organization}
              placeholder="Type your company, organization or school"
              otherLabel="Other (type your own)"
              autoComplete="organization"
            />
          )}
        </Field>
      </div>
      <Field label="Short bio" optional error={errors.bio} hint={`${values.bio.length}/${LIMITS.bio} · What you do and what you care about, in a sentence or two.`}>
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} aria-describedby={describedBy} invalid={invalid} value={values.bio} maxLength={LIMITS.bio}
            rows={3} onChange={(e) => set("bio", e.target.value)} />
        )}
      </Field>
      <Field
        label="Your profile link"
        error={errors.slug ?? (slugStatus === "taken" ? (slugMessage ?? undefined) : undefined)}
        hint={
          slugLocked ? (
            <span className="inline-flex items-center gap-1"><Lock className="size-3.5" aria-hidden /> Permanent — your printed QR codes will keep working.</span>
          ) : slugStatus === "available" ? (
            <span className="inline-flex items-center gap-1 text-success"><Check className="size-3.5" aria-hidden /> Available</span>
          ) : slugStatus === "checking" ? "Checking…" : "Lowercase letters, numbers and hyphens. This becomes permanent once you publish."
        }
      >
        {({ id, describedBy, invalid }) => (
          <div className={cn("flex h-11 items-center overflow-hidden rounded-xl border bg-surface focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15", invalid ? "border-danger" : "border-border-strong", slugLocked && "bg-surface-2")}>
            <span className="hidden shrink-0 pl-3.5 text-[15px] text-ink-3 sm:inline">{siteHost}/p/</span>
            <span className="shrink-0 pl-3.5 text-[15px] text-ink-3 sm:hidden">/p/</span>
            <input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={values.slug}
              disabled={slugLocked}
              maxLength={40}
              autoCapitalize="none"
              spellCheck={false}
              className="h-full min-w-0 flex-1 bg-transparent pr-3.5 text-[15px] text-ink focus:outline-none disabled:text-ink-2"
              onChange={(e) => {
                setSlugTouched(true);
                setSlugStatus("idle");
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              onBlur={() => checkSlug(values.slug)}
            />
          </div>
        )}
      </Field>
    </div>
  );
}

export function ContactSection({ values, errors, set }: SectionProps) {
  const update = (i: number, patch: Partial<SectionProps["values"]["contacts"][number]>) =>
    set("contacts", values.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const LABELS = { email: "Email address", whatsapp: "WhatsApp", phone: "Phone" } as const;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">
        Add the ways people can reach you. Only details switched to <strong className="font-medium text-ink">Public</strong> appear on your card.
      </p>
      {errors.contacts && <p className="text-sm text-danger">{errors.contacts}</p>}
      {/* Same layout as Website: a labelled field with its Public switch. Leave a field empty to leave it off. */}
      {values.contacts.map((c, i) => (
        <Field
          key={i}
          className={i > 0 ? "border-t border-border pt-5" : undefined}
          label={LABELS[c.type]}
          optional={c.type !== "email"}
          error={errors[`contacts.${i}.value`]}
          hint={c.type === "whatsapp" ? "Include your country code. Visitors tap to open a chat with you in WhatsApp." : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type={c.type === "email" ? "email" : "tel"}
                inputMode={c.type === "email" ? "email" : "tel"}
                autoComplete={c.type === "email" ? "email" : "tel"}
                placeholder={c.type === "email" ? "you@example.com" : "+234 803 123 4567"}
                value={c.value}
                onChange={(e) => update(i, { value: e.target.value })}
              />
              <Switch checked={c.isPublic} onChange={(v) => update(i, { isPublic: v })} label={`Show ${LABELS[c.type].toLowerCase()} publicly`} />
            </div>
          )}
        </Field>
      ))}

      <Field label="Website" optional error={errors.websiteUrl} className="border-t border-border pt-5">
        {({ id, describedBy, invalid }) => (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input id={id} aria-describedby={describedBy} invalid={invalid} type="url" inputMode="url" placeholder="example.com"
              value={values.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} />
            <Switch checked={values.websiteIsPublic} onChange={(v) => set("websiteIsPublic", v)} label="Show website publicly" />
          </div>
        )}
      </Field>
    </div>
  );
}

export function SocialSection({ values, errors, set }: SectionProps) {
  const update = (i: number, patch: Partial<SectionProps["values"]["socials"][number]>) =>
    set("socials", values.socials.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const used = new Set(values.socials.map((s) => s.platform));

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">Link the profiles you&apos;d like people to find. Paste the full link to your profile.</p>
      {errors.socials && <p className="text-sm text-danger">{errors.socials}</p>}
      {values.socials.length > 0 && (
        <ul className="flex flex-col gap-3">
          {values.socials.map((s, i) => (
            <li key={i} className="rounded-xl border border-border p-3.5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2"><SocialIcon platform={s.platform} className="size-4" /></span>
                <Select aria-label="Platform" className="h-9 max-w-[11rem] text-sm" value={s.platform}
                  onChange={(e) => update(i, { platform: e.target.value as typeof s.platform })}>
                  {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Select>
                <div className="ml-auto flex items-center gap-1">
                  <Switch checked={s.isPublic} onChange={(v) => update(i, { isPublic: v })} label={`Show ${s.platform} link publicly`} />
                  <Button variant="ghost" size="sm" aria-label="Remove link" onClick={() => set("socials", values.socials.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <Input className="mt-3" aria-label={`${s.platform} profile URL`} type="url" inputMode="url"
                placeholder={`https://${SOCIAL_PLATFORMS.find((p) => p.value === s.platform)?.hosts[0] ?? "example.com"}/you`}
                invalid={!!errors[`socials.${i}.url`]} value={s.url} onChange={(e) => update(i, { url: e.target.value })} />
              {errors[`socials.${i}.url`] && <p className="mt-1 text-sm text-danger">{errors[`socials.${i}.url`]}</p>}
            </li>
          ))}
        </ul>
      )}
      {values.socials.length < LIMITS.socials && (
        <div className="flex flex-wrap gap-2">
          {SOCIAL_PLATFORMS.filter((p) => !used.has(p.value) || p.value === "other").slice(0, 8).map((p) => (
            <Button key={p.value} variant="secondary" size="sm" icon={<SocialIcon platform={p.value} className="size-4" />}
              onClick={() => set("socials", [...values.socials, { platform: p.value, url: "", isPublic: true }])}>
              {p.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function GoalsSection({ values, set }: SectionProps) {
  const current = values.networkingGoals[0] ?? "";
  return (
    <Field
      label="What are you open to right now?"
      optional
      hint="Shows on your card as “Open to …” and helps visitors write a relevant first message."
    >
      {({ id, describedBy }) => (
        <Select
          id={id}
          aria-describedby={describedBy}
          value={current}
          onChange={(e) =>
            set("networkingGoals", e.target.value ? [e.target.value as (typeof NETWORKING_GOALS)[number]["value"]] : [])
          }
        >
          <option value="">No goal</option>
          {NETWORKING_GOALS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </Select>
      )}
    </Field>
  );
}
