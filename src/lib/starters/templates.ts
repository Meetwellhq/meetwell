import type { StarterGenerator, StarterIntent, StarterProfile } from "./types";

type Context = {
  name: string;
  /** "your work at Acme", "your work as a Product Designer", or null */
  work: string | null;
  /** "what you're building at Acme" style phrase or a neutral fallback */
  focus: string;
  goals: Set<string>;
};

type Template = (ctx: Context) => string;

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function withArticle(title: string) {
  const firstWord = title.split(/\s+/)[0];
  // Acronym-led titles ("CEO", "UX Lead") read better without an article.
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase()) return title;
  return /^[aeiou]/i.test(title) ? `an ${title}` : `a ${title}`;
}

function buildContext(profile: StarterProfile): Context {
  const title = profile.title?.trim() || null;
  const org = profile.organization?.trim() || null;

  let work: string | null = null;
  if (title && org) work = `your work as ${withArticle(title)} at ${org}`;
  else if (org) work = `your work at ${org}`;
  else if (title) work = `your work as ${withArticle(title)}`;

  return {
    name: firstName(profile.fullName),
    work,
    focus: org ? `what you're working on at ${org}` : "what you're working on",
    goals: new Set(profile.networkingGoals),
  };
}

const TEMPLATES: Record<StarterIntent, Template[]> = {
  collaborate: [
    (c) =>
      `Hi ${c.name}, I came across your profile and ${c.work ? `${c.work} caught my attention` : "liked what I saw"}. ${
        c.goals.has("collaborators") ? "I noticed you're open to collaboration — " : ""
      }I'd love to explore whether there's a project we could work on together. Would you be open to a quick chat?`,
    (c) =>
      `Hi ${c.name}, I'm interested in ${c.focus} and think there could be a good fit for a collaboration. Could we find 20 minutes to compare notes?`,
    (c) =>
      `Hi ${c.name}, I'd like to stay in touch and see if there's a way we could build something together. Let me know if you're open to it.`,
  ],
  learn: [
    (c) =>
      `Hi ${c.name}, ${c.work ? `I've been reading about ${c.work} and ` : ""}I'd really value your perspective. Would you be open to a short conversation sometime?`,
    (c) =>
      `Hi ${c.name}, I'm trying to grow in a similar direction and would appreciate learning how you approach your work. Do you have time for a quick call in the coming weeks?`,
    (c) =>
      `Hi ${c.name}, I'd love to ask you a couple of questions about how you got to where you are. No pressure at all — even a short reply would mean a lot.`,
  ],
  offer_services: [
    (c) =>
      `Hi ${c.name}, I think what I do could support ${c.focus}. If it's ever useful, I'd be happy to share a few ideas — no obligation.`,
    (c) =>
      `Hi ${c.name}, I wanted to briefly introduce what I do in case it's relevant to ${c.focus}. Happy to send a short overview if you're interested.`,
    (c) =>
      `Hi ${c.name}, if you ever need support on your next project, I'd be glad to help. Would it be okay if I sent over a few details about my work?`,
  ],
  business: [
    (c) =>
      `Hi ${c.name}, I have a business idea that I think could be relevant to ${c.focus}. Would you be open to a short call to explore it?`,
    (c) =>
      `Hi ${c.name}, I'd like to discuss a potential opportunity that might interest you${c.work ? `, given ${c.work}` : ""}. When would be a good time to talk?`,
    (c) =>
      `Hi ${c.name}, I think there may be a way for us to work together commercially. Could I share a bit more over email or a quick call?`,
  ],
  follow_up: [
    (c) =>
      `Hi ${c.name}, great meeting you! I enjoyed our conversation and wanted to follow up so we stay in touch. Let me know if you'd like to continue the chat sometime.`,
    (c) =>
      `Hi ${c.name}, following up from when we met — thanks for taking the time to talk. ${
        c.work ? `I'd love to hear more about ${c.work}.` : "I'd love to keep the conversation going."
      }`,
    (c) =>
      `Hi ${c.name}, it was good to meet you. Here's my contact so we can keep in touch — feel free to reach out any time.`,
  ],
  casual: [
    (c) =>
      `Hi ${c.name}, I came across your card and wanted to say hello. ${
        c.work ? `It's cool to see ${c.work}. ` : ""
      }Would be nice to stay connected!`,
    (c) =>
      `Hi ${c.name}, just reaching out to connect. Always happy to know more people ${c.work ? "doing interesting work" : "around here"} — let's keep in touch.`,
    (c) =>
      `Hey ${c.name}, saying hi! ${c.goals.has("networking") ? "I saw you're open to networking, so I wanted to connect. " : ""}Hope we can stay in touch.`,
  ],
};

function tidy(text: string) {
  return text.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}

/** Deterministic, profile-aware drafts for the given intent. */
export function templateStarters(intent: StarterIntent, profile: StarterProfile): string[] {
  const ctx = buildContext(profile);
  return TEMPLATES[intent].map((template) => tidy(template(ctx)));
}

export const templateGenerator: StarterGenerator = {
  async generate({ intent, profile }) {
    return templateStarters(intent, profile);
  },
};
