import { publicProfileUrl } from "@/lib/config";
import { sendMatchEmail } from "@/lib/email";
import { chooseMatch, type Candidate, type Seeker } from "@/lib/matching/engine";
import { getPublicProfile } from "@/lib/profiles/queries";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Keep each run comfortably inside the time limit; anyone not reached today is
// first in line tomorrow (due members are picked in random order each day).
const USERS_PER_RUN = 60;
const PARALLEL = 6;
const STOP_STARTING_AFTER_MS = 45_000;

type DueRow = {
  user_id: string;
  email: string;
  profile_id: string;
  full_name: string;
  title: string | null;
  organization: string | null;
  bio: string | null;
  field: string | null;
  experience_years: number | null;
  looking_for: string[] | null;
  city: string | null;
};

type CandidateRow = Omit<DueRow, "user_id" | "email"> & { slug: string; has_photo: boolean; score: number };

const toSeeker = (r: Omit<DueRow, "user_id" | "email" | "profile_id">): Seeker => ({
  fullName: r.full_name,
  title: r.title,
  organization: r.organization,
  bio: r.bio,
  field: r.field,
  experienceYears: r.experience_years,
  lookingFor: r.looking_for ?? [],
  city: r.city,
});

/**
 * Daily Spark (AI matching) run (see vercel.json). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`; the database checks the same secret.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const supabase = await createClient();
  const { data: due, error } = await supabase.rpc("matching_due_users", {
    p_token: secret,
    p_limit: USERS_PER_RUN,
  });
  if (error) {
    console.error("matching_due_users failed", error.code, error.message);
    return Response.json({ error: "due_failed" }, { status: 500 });
  }

  const tally = { matched: 0, byClaude: 0, emailed: 0, noCandidates: 0, failed: 0, skippedForTime: 0 };
  const queue = [...((due ?? []) as DueRow[])];

  async function handle(user: DueRow) {
    const { data: rows, error: candError } = await supabase.rpc("matching_candidates", {
      p_token: secret,
      p_user_id: user.user_id,
      p_limit: 8,
    });
    if (candError) throw new Error(`matching_candidates: ${candError.message}`);
    const candidates: Candidate[] = ((rows ?? []) as CandidateRow[]).map((r) => ({
      ...toSeeker(r),
      profileId: r.profile_id,
      slug: r.slug,
      hasPhoto: r.has_photo,
      score: r.score,
    }));
    if (candidates.length === 0) {
      tally.noCandidates++;
      return;
    }

    const choice = await chooseMatch(toSeeker(user), candidates);
    if (!choice) return;

    const { data: matchId, error: recordError } = await supabase.rpc("record_match", {
      p_token: secret,
      p_user_id: user.user_id,
      p_profile_id: choice.candidate.profileId,
      p_reason: choice.reason,
    });
    if (recordError) throw new Error(`record_match: ${recordError.message}`);
    if (matchId === null) return; // already matched with them, or already had a match today
    tally.matched++;
    if (choice.by === "claude") tally.byClaude++;

    // Use the public card for the email, so private fields never leak.
    const card = await getPublicProfile(choice.candidate.slug);
    if (!card) return;
    const sent = await sendMatchEmail(
      user.email,
      user.full_name,
      {
        fullName: card.fullName,
        title: card.title,
        organization: card.organization,
        avatarUrl: card.avatarUrl,
        cardUrl: publicProfileUrl(card.slug),
      },
      choice.reason,
    );
    if (sent) {
      tally.emailed++;
      await supabase.rpc("mark_match_emailed", { p_token: secret, p_match_id: matchId });
    }
  }

  async function worker() {
    while (queue.length > 0) {
      if (Date.now() - started > STOP_STARTING_AFTER_MS) {
        tally.skippedForTime += queue.length;
        queue.length = 0;
        return;
      }
      const user = queue.shift()!;
      try {
        await handle(user);
      } catch (err) {
        tally.failed++;
        console.error("Matching failed for a member", err);
      }
    }
  }

  await Promise.all(Array.from({ length: PARALLEL }, worker));
  console.log("Matches run", JSON.stringify(tally));
  return Response.json({ ok: true, ...tally });
}
