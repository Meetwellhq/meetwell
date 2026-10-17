"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/misc";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
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
