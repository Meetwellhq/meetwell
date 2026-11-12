/**
 * The admin's New email page: ready-made emails and who gets them. Shared by
 * the page, its form and the send action. The database checks the same
 * values (admin_email_audience in 20261126000000_email_campaigns.sql).
 */

export const TEMPLATES = [
  {
    id: "publish_card",
    label: "Publish your card",
    about: "For people whose card is still a draft.",
    did: "Published",
    didSentence: "published their card",
    defaults: { card: "draft" },
  },
  {
    id: "add_photo",
    label: "Add a photo",
    about: "For published cards without a photo.",
    did: "Added a photo",
    didSentence: "added a photo",
    defaults: { card: "published", noPhoto: true },
  },
  {
    id: "finish_profile",
    label: "Finish your profile",
    about: "For profiles under 80%.",
    did: "Reached 80%",
    didSentence: "finished their profile (80% or more)",
    defaults: { card: "published", under80: true },
  },
  {
    id: "spark_beta",
    label: "Try Spark",
    about: "Introduces Spark, our AI introductions.",
    did: "Spark on",
    didSentence: "turned Spark on",
    defaults: {},
  },
  {
    id: "mentoring",
    label: "Mentoring is open",
    about: "Explains mentoring for both sides.",
    did: "Added years",
    didSentence: "added their years of experience",
    defaults: {},
  },
] as const satisfies readonly {
  id: string;
  label: string;
  about: string;
  /** What "did it" means in the results: worked out from their profile now. */
  did: string;
  /** The same, for a sentence: "13 of 40 people have published their card". */
  didSentence: string;
  defaults: Partial<Omit<Audience, "template">>;
}[];

export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const ROLES = ["all", "mentor", "mentee", "unset"] as const;
export const CARDS = ["all", "published", "draft", "unpublished", "none"] as const;
/** "Not logged in for…" choices, in days. */
export const INACTIVE_DAYS = [7, 14, 30, 60] as const;
/** "Send again to people who had it more than … days ago" choices. */
export const RESEND_DAYS = [7, 14, 30] as const;

export type Audience = {
  template: TemplateId;
  role: (typeof ROLES)[number];
  card: (typeof CARDS)[number];
  noPhoto: boolean;
  under80: boolean;
  inactiveDays: number | null;
  resendDays: number | null;
};

const pick = <T extends string | number>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Reads the page address (or the send form) into a checked audience. */
export function parseAudience(params: Record<string, string | string[] | undefined>): Audience {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const template = pick(TEMPLATES.map((t) => t.id), one("template"), "publish_card");
  // A template on its own (just picked) brings its suggested audience.
  const fresh = !["role", "card", "photo", "under80", "inactive", "resend"].some((k) => one(k) !== undefined);
  const d: Partial<Omit<Audience, "template">> = fresh ? TEMPLATES.find((t) => t.id === template)!.defaults : {};
  return {
    template,
    role: pick(ROLES, one("role"), d.role ?? "all"),
    card: pick(CARDS, one("card"), d.card ?? "all"),
    noPhoto: fresh ? !!d.noPhoto : one("photo") === "none",
    under80: fresh ? !!d.under80 : one("under80") === "1",
    inactiveDays: pick<number>(INACTIVE_DAYS, Number(one("inactive")), 0) || null,
    resendDays: pick<number>(RESEND_DAYS, Number(one("resend")), 0) || null,
  };
}

/** The same audience as database arguments. */
export function audienceArgs(a: Audience) {
  return {
    p_template: a.template,
    p_role: a.role,
    p_card: a.card,
    p_no_photo: a.noPhoto,
    p_under_80: a.under80,
    p_inactive_days: a.inactiveDays,
    p_resend_days: a.resendDays,
  };
}

/** The audience as address values (what the page and the send action read). */
export function audienceParams(a: Audience): Record<string, string> {
  return {
    template: a.template,
    role: a.role,
    card: a.card,
    photo: a.noPhoto ? "none" : "any",
    under80: a.under80 ? "1" : "0",
    inactive: a.inactiveDays ? String(a.inactiveDays) : "",
    resend: a.resendDays ? String(a.resendDays) : "",
  };
}
