import { lagosToday, radarCsv, type RadarEvent } from "@/lib/radar";
import { createClient } from "@/lib/supabase/server";

/** Every radar event as a CSV file that opens in Excel. Admins only (the database checks). */
export async function GET() {
  const { data, error } = await (await createClient()).rpc("admin_list_radar");
  if (error) return new Response("Not found", { status: 404 });
  const today = lagosToday();
  // The byte-order mark makes Excel read the file as UTF-8
  return new Response(`﻿${radarCsv((data ?? []) as RadarEvent[], today)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="Meetwell_Partner_Radar_${today}.csv"`,
      "cache-control": "no-store",
    },
  });
}
