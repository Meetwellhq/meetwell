import { notFound } from "next/navigation";
import { isSupabaseConfigured, qrTargetUrl } from "@/lib/config";
import { getPublicProfile } from "@/lib/profiles/queries";
import { qrPng } from "@/lib/qr";

/**
 * Public QR image for a published card, used in emails (Gmail won't show
 * images embedded in the email itself). Unpublished or unknown cards get 404.
 */
export async function GET(_request: Request, { params }: RouteContext<"/p/[slug]/qr">) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) notFound();
  const profile = await getPublicProfile(slug);
  if (!profile) return new Response("Profile not available", { status: 404 });

  const png = await qrPng(qrTargetUrl(profile.slug), 512);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Short cache: if the card is unpublished, the image stops working soon after.
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
