import type { PublicProfile } from "../profiles/types";

export const STARTER_INTENTS = [
  { value: "collaborate", label: "Collaborate" },
  { value: "learn", label: "Learn from them" },
  { value: "offer_services", label: "Offer my services" },
  { value: "business", label: "Business opportunity" },
  { value: "follow_up", label: "Follow up after meeting" },
  { value: "casual", label: "Connect casually" },
] as const;

export type StarterIntent = (typeof STARTER_INTENTS)[number]["value"];

/** Only public profile fields are ever passed to a generator. */
export type StarterProfile = Pick<
  PublicProfile,
  "fullName" | "title" | "organization" | "networkingGoals"
>;

export type StarterRequest = {
  intent: StarterIntent;
  profile: StarterProfile;
};

/**
 * Anything that can suggest opening messages. The MVP ships a deterministic
 * template generator; an AI-backed implementation can satisfy the same
 * interface (e.g. by calling a server route) without changing the UI.
 *
 * Contract for every implementation: messages are short, editable drafts that
 * never claim the two people met (unless the visitor chose "follow_up"), never
 * invent shared experiences, and only use the profile fields provided.
 */
export interface StarterGenerator {
  generate(request: StarterRequest): Promise<string[]>;
}
