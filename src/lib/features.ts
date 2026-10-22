/** Meetwell's features, for the footer and the /features/[slug] pages. Product facts only. */
export type FeatureSlug = "qr-card" | "icebreaker" | "contacts" | "spark" | "mentoring";

export type FeaturePage = {
  slug: FeatureSlug;
  name: string;
  title: string;
  intro: string;
  steps: { title: string; body: string }[];
  details: string[];
};

export const FEATURES: FeaturePage[] = [
  {
    slug: "qr-card",
    name: "QR card",
    title: "Your card, one scan away.",
    intro:
      "Your Meetwell card has its own QR code. People point their phone camera at it and your card opens. No app, no typing.",
    steps: [
      { title: "Make your card", body: "Add your photo, title, company, a short bio and the ways people can reach you." },
      { title: "Share your QR code", body: "Show it on your phone, print it, or put it on a slide. The code never changes." },
      { title: "They save you in one tap", body: "Your card opens in their browser and saves straight to their phone's contacts." },
    ],
    details: [
      "Works with any phone camera.",
      "Each contact detail and link can be Public or Private.",
      "Unpublish your card anytime to take it offline.",
      "See how many people viewed your card, scanned your code and saved you.",
    ],
  },
  {
    slug: "icebreaker",
    name: "Icebreaker",
    title: "Never stare at a blank message again.",
    intro:
      "When someone opens your card, Icebreaker writes them a short first message based on who you are, ready to edit and send.",
    steps: [
      { title: "They pick a reason", body: "Collaborate, learn from you, offer their services, or follow up after meeting." },
      { title: "A message appears", body: "It mentions your title and company, so it never feels like a template." },
      { title: "They send it their way", body: "Copy it into email, WhatsApp or anywhere else. We never see it." },
    ],
    details: [
      "Written in the visitor's own browser, never sent to us.",
      "Visitors can try another version or edit it freely.",
      "Turns a quick hello at an event into a real follow-up.",
    ],
  },
  {
    slug: "contacts",
    name: "Contacts",
    title: "Every card you scan, kept.",
    intro:
      "Everyone whose card you open lands in your Contacts, with the date and a note on where you met. Your phone book for people you meet in person.",
    steps: [
      { title: "Scan a card", body: "When you're logged in, opening someone's card adds them to Contacts automatically." },
      { title: "Add a note", body: "Write where you met or what you talked about, so you remember later." },
      { title: "Save to your phone", body: "Save one person, or export everyone in one file your phone can import." },
    ],
    details: [
      "Search by name, company or note.",
      "See which members saved your card, and save them back.",
      "No account yet? Cards you open are kept on your phone and come with you when you join.",
    ],
  },
  {
    slug: "spark",
    name: "Spark",
    title: "Meet people a few steps ahead.",
    intro:
      "Spark uses AI to introduce you to someone with more experience in your field, and tells you why you should talk.",
    steps: [
      { title: "Tell Spark about you", body: "Your field, years of experience, what you're looking for and your city. This stays private." },
      { title: "Get an introduction", body: "Spark picks someone with more experience in the same or a related field." },
      { title: "Reach out", body: "Open their card and say hello. Spark explains why you'd be a good match." },
    ],
    details: [
      "Up to 5 free introductions a month, at most one a day.",
      "Want more? Buy Spark credits on your Spark page.",
      "People with 4+ years are recommended to others, not introduced.",
      "Turn Spark on or off anytime.",
    ],
  },
  {
    slug: "mentoring",
    name: "Mentoring",
    title: "Get paid for what you know.",
    intro:
      "With 4+ years of experience, you can become a mentor on Meetwell. People earlier in their careers pay a monthly price to message you directly.",
    steps: [
      { title: "Apply", body: "Members with 4+ years, a photo and a complete card can apply. We review every mentor." },
      { title: "Set your price", body: "Choose a 30-day price between ₦2,000 and ₦20,000. Your card shows a Message button." },
      { title: "Answer and earn", body: "Reply to messages, keep 80% of every payment and withdraw to your bank." },
    ],
    details: [
      "Payments are handled by Paystack. We never see card details.",
      "Members get a full refund if a mentor doesn't reply within 7 days.",
      "Nothing renews by itself. Members get a reminder before 30 days end.",
      "Block and report are built into every conversation.",
    ],
  },
];

export const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug);
