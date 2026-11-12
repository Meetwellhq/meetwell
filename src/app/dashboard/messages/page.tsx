import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import { Alert, EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Messages" };

/** No conversation open: payment notes, and (laptops up) a prompt beside the list. */
export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const { payment } = await searchParams;

  return (
    // Phones show this only for a payment note; the list is the page there.
    <div className={payment ? "flex h-full flex-col gap-4 p-4" : "hidden h-full flex-col gap-4 p-4 lg:flex"}>
      {payment === "pending" && (
        <Alert>We&apos;re confirming your payment with Paystack. Your conversation will appear here in a minute.</Alert>
      )}
      {payment === "failed" && <Alert tone="danger">The payment didn&apos;t go through, so you weren&apos;t charged.</Alert>}
      <div className="hidden flex-1 items-center justify-center lg:flex">
        <EmptyState
          icon={<MessagesSquare className="size-5" aria-hidden />}
          title="Pick a conversation"
          description="Choose someone on the left to read and reply."
        />
      </div>
    </div>
  );
}
