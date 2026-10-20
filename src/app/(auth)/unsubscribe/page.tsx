import type { Metadata } from "next";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { UnsubscribeForm } from "@/components/auth/unsubscribe-form";
import { SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.slice(0, 64) : "";

  return (
    <>
      <AuthIntro title="Stop Meetwell updates?">
        You&apos;ll stop getting occasional updates, like new members you might want to meet. You&apos;ll stay on the
        waiting list and still get your invite.
      </AuthIntro>
      <AuthSection>
        {token ? (
          <UnsubscribeForm token={token} />
        ) : (
          <p className="text-sm text-ink-2">
            This link is missing its code. Use the unsubscribe link from your email, or write to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent underline">{SUPPORT_EMAIL}</a>.
          </p>
        )}
      </AuthSection>
    </>
  );
}
