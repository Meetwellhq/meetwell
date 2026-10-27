import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/config";
import { qrPng } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

/** QR code (PNG) of a shared code's sign-up link, for slides and posters. Admins only. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const code = (request.nextUrl.searchParams.get("code") ?? "").toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{6,32}$/.test(code)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const png = await qrPng(`${getSiteUrl()}/access-code?code=${encodeURIComponent(code)}`, 1024);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="meetwell-${code.toLowerCase()}-qr.png"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
