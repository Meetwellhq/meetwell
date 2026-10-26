import type { Metadata } from "next";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { SavebackEmailsOffForm } from "@/components/dashboard/saveback-emails-off-form";

export const metadata: Metadata = { title: "Save-back emails", robots: { index: false } };

export default async function SavebackEmailsOffPage({ searchParams }: PageProps<"/unsubscribe/contacts">) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.slice(0, 64) : "";

  return (
    <>
      <AuthIntro title="Turn off save-back emails?">
        You won&apos;t get emails when someone saves your card back. You&apos;ll still see them in Contacts, and you can
        turn emails back on in Settings.
      </AuthIntro>
      <AuthSection>
        {token ? (
          <SavebackEmailsOffForm token={token} />
        ) : (
          <p className="text-sm text-ink-2">This link is missing its code. You can turn emails off in Settings instead.</p>
        )}
      </AuthSection>
    </>
  );
}
