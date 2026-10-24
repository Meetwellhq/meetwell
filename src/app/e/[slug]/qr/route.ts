import { NextResponse, type NextRequest } from "next/server";
import { eventQrTarget } from "@/lib/events";
import { getPublicEvent } from "@/lib/events-queries";
import { qrPng, qrSvg } from "@/lib/qr";

/**
 * QR codes for an event: the event page (for slides and posters), or with
 * ?speaker=<card> one speaker's card (for badges). Public, like the page.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/e/[slug]/qr">) {
  const { slug } = await params;
  const found = await getPublicEvent(slug);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const speaker = request.nextUrl.searchParams.get("speaker");
  if (speaker && !found.speakers.some((s) => s.slug === speaker)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const format = request.nextUrl.searchParams.get("format") === "svg" ? "svg" : "png";
  const target = eventQrTarget(found.event.slug, speaker ?? undefined);
  const headers = {
    "Content-Disposition": `attachment; filename="${speaker ? `${found.event.slug}-${speaker}` : found.event.slug}-qr.${format}"`,
    "Cache-Control": "public, max-age=300",
  };
  if (format === "svg") {
    return new Response(await qrSvg(target, { margin: 4 }), {
      headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  }
  const png = await qrPng(target, 1024);
  return new Response(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}
