import { sendFundingFindsEmail } from "@/lib/email";
import type { Funding } from "@/lib/funding";
import { createClient } from "@/lib/supabase/server";

/**
 * The weekly funding search (a claude.ai routine) talks to the funding radar here,
 * with the partner radar's key, `Authorization: Bearer <RADAR_IMPORT_SECRET>`. That
 * key can only read what's listed and add new finds; the database calls use
 * CRON_SECRET, which never leaves the server.
 *
 * GET: what's already listed (id, name, funder, deadline), so the search skips it.
 *
 * POST `{ "items": [{ "name", "funder", "kind", "amount", "equity_free", "deadline",
 * "region", "link", "eligibility", "fit", "prepare" }] }`: adds the new ones. Ones
 * already listed, and past deadlines, are left out. The founder gets an email at
 * the admin inbox for the new ones.
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
  const { data, error } = await (await createClient()).rpc("funding_known", { p_token: secret });
  if (error) {
    console.error("funding_known failed", error.code, error.message);
    return Response.json({ error: "Couldn't read the funding radar" }, { status: 500 });
  }
  return Response.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const secret = authorise(request);
  if (!secret) return unauthorised();
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    return Response.json({ error: "Send { items: [...] } with 1 to 100 opportunities" }, { status: 400 });
  }

  const { data, error } = await (await createClient()).rpc("funding_import", { p_token: secret, p_items: body.items });
  if (error) {
    console.error("funding_import failed", error.code, error.message);
    return Response.json(
      {
        error:
          "Couldn't add them. Check each has a name, deadline is YYYY-MM-DD or left out, kind is one of grant, accelerator, competition, fellowship, investor, loan, other, region is Nigeria, Africa or Global, and links start with https://",
      },
      { status: 400 },
    );
  }
  const added = (data ?? []) as Funding[];
  const emailed = await sendFundingFindsEmail(added);
  return Response.json({ added: added.map((f) => f.name), skipped: body.items.length - added.length, emailed });
}
