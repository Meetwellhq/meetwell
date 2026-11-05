import { sendRadarFindsEmail } from "@/lib/email";
import type { RadarEvent } from "@/lib/radar";
import { createClient } from "@/lib/supabase/server";

/**
 * The weekly event search (a claude.ai routine) talks to the partner radar here,
 * with `Authorization: Bearer <RADAR_IMPORT_SECRET>`. That secret can only read
 * the radar's event names and add events; the database calls use CRON_SECRET,
 * which never leaves the server.
 *
 * GET: what's already on the radar (id, name, start_date, end_date), so the
 * search skips events it already found.
 *
 * POST `{ "events": [{ "name", "start", "end", "category", "format", "venue",
 * "organizer", "link", "contact", "angle", "hook", "idea", "offer", "subject" }] }`:
 * adds the new ones. Events already on the radar are left alone. The founder gets
 * an email at the admin inbox for the new ones (with and without a contact email).
 */
function authorise(request: Request) {
  const key = process.env.RADAR_IMPORT_SECRET;
  const db = process.env.CRON_SECRET;
  if (!key || key.length < 32 || !db || request.headers.get("authorization") !== `Bearer ${key}`) return null;
  return db;
}

const unauthorised = () => Response.json({ error: "unauthorized" }, { status: 401 });

export async function GET(request: Request) {
  const secret = authorise(request);
  if (!secret) return unauthorised();
  const { data, error } = await (await createClient()).rpc("radar_known_events", { p_token: secret });
  if (error) {
    console.error("radar_known_events failed", error.code, error.message);
    return Response.json({ error: "Couldn't read the radar" }, { status: 500 });
  }
  return Response.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  const secret = authorise(request);
  if (!secret) return unauthorised();
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
  return Response.json({ added: added.map((e) => e.name), skipped: body.events.length - added.length, emailed });
}
