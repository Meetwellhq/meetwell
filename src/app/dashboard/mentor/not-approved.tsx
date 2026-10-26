import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";

/** Shown on Wallet and Transactions before the member is an approved mentor. */
export function NotApproved({ what }: { what: string }) {
  return (
    <Card className="flex flex-col items-start gap-3 p-5 sm:p-6">
      <p className="text-ink-2">Your {what} opens once you&apos;re an approved mentor.</p>
      <Link href="/dashboard/mentor" className={buttonClass({ size: "sm" })}>
        Go to Mentoring
      </Link>
    </Card>
  );
}
