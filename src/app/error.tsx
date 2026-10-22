"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The error page catches the crash, so tell Sentry about it here.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface">
        <EmptyState
          icon={<AlertTriangle className="size-6" />}
          title="Something went wrong"
          description="Please try again. If the problem continues, come back in a few minutes."
          action={<Button onClick={reset}>Try again</Button>}
        />
      </div>
    </main>
  );
}
