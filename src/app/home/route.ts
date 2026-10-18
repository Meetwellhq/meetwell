import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";

/** Where the logo points: the dashboard when signed in, otherwise the landing page. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  return NextResponse.redirect(new URL(user ? "/dashboard" : "/", request.url));
}
