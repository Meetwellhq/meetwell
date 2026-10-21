import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "../config";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/admin"];
const AUTH_PAGES = ["/sign-in", "/sign-up", "/early-access", "/access-code"];

/**
 * Refreshes the Supabase session cookie on every matched request and performs
 * optimistic redirects. Real authorization happens in server code and RLS.
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/sign-in") url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // The admin area has its own log-in page.
  if (!signedIn && pathname.startsWith("/admin") && pathname !== "/admin/sign-in") {
    return redirectTo("/admin/sign-in");
  }
  if (!signedIn && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !pathname.startsWith("/admin")) {
    return redirectTo("/sign-in");
  }
  if (signedIn && AUTH_PAGES.includes(pathname)) {
    return redirectTo("/dashboard");
  }

  return response;
}
