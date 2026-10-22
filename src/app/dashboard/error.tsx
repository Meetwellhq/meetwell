"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/misc";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The error page catches the crash, so tell Sentry about it here.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <Card>
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        title="Something went wrong"
        description="We couldn't load this page. Check your connection and try again."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
