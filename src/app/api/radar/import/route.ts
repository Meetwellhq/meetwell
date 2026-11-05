import { sendRadarFindsEmail } from "@/lib/email";
import type { RadarEvent } from "@/lib/radar";
import { createClient } from "@/lib/supabase/server";

/**
 * The weekly event search posts its finds here:
 * `POST /api/radar/import` with `Authorization: Bearer <CRON_SECRET>` and
 * `{ "events": [{ "name", "start", "end", "category", "format", "venue",
 * "organizer", "link", "contact", "angle", "hook", "idea", "subject" }] }`.
 * Events already on the radar are left alone. The database checks the secret again.
 * The founder gets one email at the admin inbox listing the events that were new.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { events?: unknown } | null;
  if (!body || !Array.isArray(body.events) || body.events.length === 0 || body.events.length > 100) {
    return Response.json({ error: "Send { events: [...] } with 1 to 100 events" }, { status: 400 });
  }

  const { data, error } = await (await createClient()).rpc("radar_import_events", { p_token: secret, p_events: body.events });
  if (error) {
    console.error("radar_import_events failed", error.code, error.message);
    return Response.json({ error: "Couldn't add the events. Check each has a name and a start date (YYYY-MM-DD)." }, { status: 400 });
  }
  const added = (data ?? []) as RadarEvent[];
  const emailed = await sendRadarFindsEmail(added);
  return Response.json({ added: added.length, sent: body.events.length, emailed });
}
