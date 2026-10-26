import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import { Alert, EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Messages" };

/** No conversation open: payment notes, and (laptops up) a prompt beside the list. */
export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const { payment } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      {payment === "pending" && (
        <Alert>We&apos;re confirming your payment with Paystack. Your conversation will appear here in a minute.</Alert>
      )}
      {payment === "failed" && <Alert tone="danger">The payment didn&apos;t go through, so you weren&apos;t charged.</Alert>}
      <div className="hidden min-h-[60vh] items-center justify-center rounded-xl border border-border bg-surface lg:flex">
        <EmptyState
          icon={<MessagesSquare className="size-5" aria-hidden />}
          title="Pick a conversation"
          description="Choose someone on the left to read and reply."
        />
      </div>
    </div>
  );
}
