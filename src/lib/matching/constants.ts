/** Spark (AI matching): shared labels and limits. Values must match the database checks. */

/** Free Spark matches per calendar month (Lagos time). Matches `spark_free_per_month()` in SQL. */
export const SPARK_FREE_PER_MONTH = 1;

/**
 * Years of experience that make a member a mentor on Spark: recommended to people earlier in
 * their careers, and not introduced to anyone themselves. Matches the 4-year checks in SQL.
 */
export const MENTOR_MIN_YEARS = 4;
export const isMentor = (years: number | null | undefined) => years != null && years >= MENTOR_MIN_YEARS;

/** "1 November": when the free matches reset, in Lagos time. */
export function sparkResetDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "numeric" })
    .formatToParts(now);
  const part = (type: "year" | "month") => Number(parts.find((p) => p.type === type)!.value);
  // Month is 1-based here, so Date.UTC(year, month) is next month. Noon UTC is the 1st in Lagos too.
  const next = new Date(Date.UTC(part("year"), part("month"), 1, 12));
  return next.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" });
}

export const FIELDS = [
  { value: "product_design", label: "Product design" },
  { value: "software_engineering", label: "Software engineering" },
  { value: "data_ai", label: "Data & AI" },
  { value: "product_management", label: "Product management" },
  { value: "marketing_growth", label: "Marketing & growth" },
  { value: "sales_bizdev", label: "Sales & business development" },
  { value: "finance_fintech", label: "Finance & fintech" },
  { value: "founder", label: "Founder / entrepreneur" },
  { value: "content_media", label: "Content & media" },
  { value: "operations", label: "Operations" },
  { value: "people_hr", label: "People & HR" },
  { value: "legal", label: "Legal" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
] as const;

export const LOOKING_FOR = [
  { value: "mentor", label: "A mentor (someone more experienced)" },
  { value: "mentee", label: "To mentor someone" },
  { value: "peers", label: "Peers at my level" },
  { value: "collaborators", label: "Collaborators for projects" },
  { value: "opportunities", label: "Jobs or clients" },
] as const;

export type FieldValue = (typeof FIELDS)[number]["value"];
export type LookingForValue = (typeof LOOKING_FOR)[number]["value"];

export const fieldLabel = (value: string | null | undefined) =>
  FIELDS.find((f) => f.value === value)?.label ?? null;
