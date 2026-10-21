/** AI Network Matching: shared labels and limits. Values must match the database checks. */

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
