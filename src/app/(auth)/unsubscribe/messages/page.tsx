import type { Metadata } from "next";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { MessageEmailsOffForm } from "@/components/messaging/message-emails-off-form";

export const metadata: Metadata = { title: "Message emails", robots: { index: false } };

export default async function MessageEmailsOffPage({ searchParams }: PageProps<"/unsubscribe/messages">) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.slice(0, 64) : "";

  return (
    <>
      <AuthIntro title="Turn off message emails?">
        You won&apos;t get emails about new messages. Your messages will still be waiting in Meetwell, and you can turn
        emails back on in Settings.
      </AuthIntro>
      <AuthSection>
        {token ? (
          <MessageEmailsOffForm token={token} />
        ) : (
          <p className="text-sm text-ink-2">This link is missing its code. You can turn emails off in Settings instead.</p>
        )}
      </AuthSection>
    </>
  );
}
