import { UserRoundX } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { JOIN_CTA, SIGNUPS_OPEN } from "@/lib/config";

export default function ProfileNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface">
        <EmptyState
          icon={<UserRoundX className="size-6" />}
          title="This card isn't available"
          description="The person may have unpublished or deleted their profile, or the link may be mistyped."
          action={<ButtonLink href={JOIN_CTA.href}>{SIGNUPS_OPEN ? "Create your own card" : JOIN_CTA.label}</ButtonLink>}
        />
      </div>
      <div className="mt-8">
        <Logo />
      </div>
    </main>
  );
}
