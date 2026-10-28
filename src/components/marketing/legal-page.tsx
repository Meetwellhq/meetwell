import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

async function isSignedIn() {
  if (!isSupabaseConfigured()) return false;
  try {
    return !!(await getCurrentUser());
  } catch {
    return false;
  }
}

/** Terms, Privacy and Community rules: the site header and footer around a readable column. */
export async function LegalPage({ title, updated, intro, children }: { title: string; updated?: string; intro?: ReactNode; children: ReactNode }) {
  const signedIn = await isSignedIn();
  return (
    <div className="light-only flex min-h-full flex-col bg-surface">
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14 sm:py-20">
        <h1 className="font-display text-fluid-page leading-none tracking-tight text-ink">{title}</h1>
        {updated && <p className="mt-4 text-sm text-ink-3">Last updated {updated}</p>}
        {intro && <p className="mt-4 text-ink-2">{intro}</p>}
        <div className="mt-10 space-y-8 leading-relaxed text-ink-2 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </main>
      <SiteFooter wide />
    </div>
  );
}
