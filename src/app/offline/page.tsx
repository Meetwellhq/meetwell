import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };

/** Shown by the service worker (public/sw.js) when the installed app has no connection. */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-surface">
        <EmptyState
          icon={<WifiOff className="size-6" />}
          title="You're offline"
          description="Meetwell needs a connection. Check your data or Wi-Fi, then try again."
          action={<ButtonLink href="/home">Try again</ButtonLink>}
        />
      </div>
    </main>
  );
}
