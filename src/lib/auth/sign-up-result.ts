/**
 * Interpret Supabase's signUp response.
 *
 * Supabase never creates two accounts for one email, but by default it hides
 * that an email is taken: for an already-confirmed address it returns a
 * "success" with a placeholder user whose `identities` list is empty, and
 * sends no email. We treat that as "account already exists" so we don't tell
 * the person a confirmation link is on its way.
 */
export type SignUpOutcome = "exists" | "confirm-email" | "signed-in";

export function classifySignUp(
  data: { user: { identities?: unknown[] | null } | null; session: unknown | null },
  errorCode?: string | null,
): SignUpOutcome {
  if (errorCode === "user_already_exists" || errorCode === "email_exists") return "exists";
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return "exists";
  return data.session ? "signed-in" : "confirm-email";
}
