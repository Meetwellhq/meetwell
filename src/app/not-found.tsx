import { Compass } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-surface">
        <EmptyState
          icon={<Compass className="size-6" />}
          title="Page not found"
          description="The page you're looking for doesn't exist or has moved."
          action={<ButtonLink href="/">Go home</ButtonLink>}
        />
      </div>
    </main>
  );
}
