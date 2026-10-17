import { NextResponse, type NextRequest } from "next/server";
import { qrTargetUrl } from "@/lib/config";
import { getOwnProfile } from "@/lib/profiles/queries";
import { qrPng, qrSvg } from "@/lib/qr";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getOwnProfile();
  if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const format = request.nextUrl.searchParams.get("format") === "svg" ? "svg" : "png";
  const target = qrTargetUrl(profile.slug);
  const filename = `${profile.slug}-qr.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };

  if (format === "svg") {
    return new Response(await qrSvg(target, { margin: 4 }), {
      headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  }
  const png = await qrPng(target, 1024);
  return new Response(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}
