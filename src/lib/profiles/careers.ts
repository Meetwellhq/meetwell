/**
 * Suggested job titles and companies for the card editor. Both stay free text
 * in the database: anyone can pick "Other" and type their own.
 */

export const TITLE_GROUPS = [
  {
    label: "Tech careers",
    titles: [
      "Software Engineer",
      "Frontend Engineer",
      "Backend Engineer",
      "Full-Stack Engineer",
      "Mobile Engineer",
      "DevOps Engineer",
      "Cloud Engineer",
      "QA Engineer",
      "Data Analyst",
      "Data Scientist",
      "Data Engineer",
      "Machine Learning Engineer",
      "AI Engineer",
      "Product Manager",
      "Product Designer",
      "UX Researcher",
      "Cybersecurity Analyst",
      "Solutions Architect",
      "Engineering Manager",
      "Scrum Master",
      "Technical Writer",
      "IT Support Specialist",
      "CTO",
      "Founder",
      "Founder & CEO",
      "Co-founder",
    ],
  },
  {
    // What kind of place it is, for cards like "Software Company · Meetwell".
    label: "Organisations",
    titles: [
      "Software Company",
      "Software Community",
      "Tech Community",
      "Startup",
      "Agency",
      "NGO",
      "Non-profit",
      "Government Agency",
    ],
  },
] as const;

export const TITLE_OPTIONS: readonly string[] = TITLE_GROUPS.flatMap((g) => g.titles);

export type Company = {
  name: string;
  /** Other ways people write the name; matched case-insensitively. */
  aliases: string[];
  /** Square logo in /public/companies, or null to show the plain company icon. */
  logo: string | null;
};

export const COMPANIES: Company[] = [
  { name: "Flutterwave", aliases: [], logo: "/companies/flutterwave.png" },
  { name: "Paystack", aliases: [], logo: null },
  { name: "Moniepoint", aliases: ["Moniepoint Inc", "Moniepoint MFB"], logo: "/companies/moniepoint.png" },
  { name: "OPay", aliases: ["Opay Digital Services"], logo: "/companies/opay.png" },
  { name: "Interswitch", aliases: ["Interswitch Group"], logo: "/companies/interswitch.png" },
  { name: "Andela", aliases: [], logo: "/companies/andela.png" },
  { name: "Kuda", aliases: ["Kuda Bank", "Kuda Microfinance Bank"], logo: "/companies/kuda.png" },
  { name: "MTN Nigeria", aliases: ["MTN"], logo: "/companies/mtn.png" },
  { name: "Access Bank", aliases: ["Access Bank Plc", "Access Holdings"], logo: null },
  { name: "Dangote Group", aliases: ["Dangote", "Dangote Industries"], logo: null },
  { name: "Raenest", aliases: ["Raenest (formerly Geegpay)", "Geegpay"], logo: "/companies/raenest.png" },
  { name: "Meetwell", aliases: ["Meet Well", "Meet Well Limited", "MeetWell"], logo: "/companies/meetwell.png" },
];

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The known company for a card's organisation text, if any. */
export function findCompany(organization: string | null | undefined): Company | null {
  if (!organization?.trim()) return null;
  const key = normalise(organization);
  return COMPANIES.find((c) => [c.name, ...c.aliases].some((n) => normalise(n) === key)) ?? null;
}
