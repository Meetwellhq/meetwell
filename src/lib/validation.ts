import { z } from "zod";
import { isAvatarStorageUrl } from "./profiles/avatar";
import {
  CONTACT_TYPES,
  LIMITS,
  NETWORKING_GOALS,
  RESERVED_SLUGS,
  SOCIAL_PLATFORMS,
} from "./profiles/constants";

/**
 * Normalise a user-entered web address. Adds https:// when no scheme is
 * given, and rejects anything that is not http(s), has embedded credentials or
 * lacks a real hostname. Returns null when the value is not a safe URL.
 */
export function normalizeWebUrl(input: string, { httpsOnly = false } = {}): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 300 || /\s/.test(trimmed)) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && (httpsOnly || url.protocol !== "http:")) return null;
  if (url.username || url.password) return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null;

  return url.toString();
}

/** Keep a leading + and digits; accept 7–15 digits (E.164 range). */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

/** Hostname matches one of the platform's domains (or a subdomain of it). */
export function urlMatchesPlatform(url: string, platform: string): boolean {
  const def = SOCIAL_PLATFORMS.find((p) => p.value === platform);
  if (!def || def.hosts.length === 0) return true;
  const host = new URL(url).hostname.toLowerCase();
  return def.hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(40, "Use 40 characters or fewer")
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Use lowercase letters, numbers and single hyphens")
  .refine((s) => !s.includes("--"), "Use single hyphens only")
  .refine((s) => !RESERVED_SLUGS.has(s), "That link is reserved. Try another.");

const contactSchema = z
  .object({
    type: z.enum(CONTACT_TYPES.map((c) => c.value) as [string, ...string[]]),
    value: z.string().trim().min(1, "Enter a value"),
    label: optionalText(40),
    isPublic: z.boolean(),
  })
  .transform((c, ctx) => {
    if (c.type === "email") {
      const parsed = z.email().safeParse(c.value.toLowerCase());
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: "Enter a valid email address", path: ["value"] });
        return z.NEVER;
      }
      return { ...c, value: parsed.data } as const;
    }
    const phone = normalizePhone(c.value);
    if (!phone) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a phone number with country code, e.g. +1 415 555 0100",
        path: ["value"],
      });
      return z.NEVER;
    }
    return { ...c, value: phone } as const;
  });

const socialSchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS.map((p) => p.value) as [string, ...string[]]),
    url: z.string().trim().min(1, "Enter a link"),
    isPublic: z.boolean(),
  })
  .transform((s, ctx) => {
    const url = normalizeWebUrl(s.url, { httpsOnly: true });
    if (!url) {
      ctx.addIssue({ code: "custom", message: "Enter a valid https:// link", path: ["url"] });
      return z.NEVER;
    }
    if (!urlMatchesPlatform(url, s.platform)) {
      ctx.addIssue({
        code: "custom",
        message: "That link doesn't look like it belongs to this platform",
        path: ["url"],
      });
      return z.NEVER;
    }
    return { ...s, url };
  });

export const profileInputSchema = z
  .object({
    slug: slugSchema,
    fullName: z
      .string()
      .trim()
      .min(1, "Enter your name")
      .max(LIMITS.fullName, `Keep this under ${LIMITS.fullName} characters`),
    avatarUrl: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        if (!isAvatarStorageUrl(v) || v.length > 500) {
          ctx.addIssue({ code: "custom", message: "Invalid photo URL" });
          return z.NEVER;
        }
        return v;
      }),
    title: optionalText(LIMITS.title),
    organization: optionalText(LIMITS.organization),
    bio: optionalText(LIMITS.bio),
    websiteUrl: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const url = normalizeWebUrl(v);
        if (!url) {
          ctx.addIssue({ code: "custom", message: "Enter a valid website, e.g. example.com" });
          return z.NEVER;
        }
        return url;
      }),
    websiteIsPublic: z.boolean(),
    networkingGoals: z
      .array(z.enum(NETWORKING_GOALS.map((g) => g.value) as [string, ...string[]]))
      .max(NETWORKING_GOALS.length)
      .transform((goals) => [...new Set(goals)]),
    contacts: z.array(contactSchema).max(LIMITS.contacts, `Add up to ${LIMITS.contacts} contact methods`),
    socials: z.array(socialSchema).max(LIMITS.socials, `Add up to ${LIMITS.socials} links`),
  });

export type ProfileInput = z.input<typeof profileInputSchema>;
export type ValidProfile = z.output<typeof profileInputSchema>;

/** Flatten Zod issues into { "contacts.0.value": "message" } for field-level display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer");
