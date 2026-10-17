import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="October 17, 2026">
      <section>
        <p>
          These terms are a plain-language starting point for the {APP_NAME} MVP and should be reviewed by a qualified
          lawyer before a public launch.
        </p>
      </section>
      <section>
        <h2>Your card</h2>
        <ul>
          <li>You must be at least 16 years old to create an account.</li>
          <li>Only publish information about yourself, and only information you have the right to share.</li>
          <li>Don&apos;t impersonate others, publish misleading content or use the service to spam people.</li>
        </ul>
      </section>
      <section>
        <h2>Our service</h2>
        <p>
          {APP_NAME} is provided as is while in early access. We may change or discontinue features, and we may
          unpublish cards that break these terms.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Email <a className="text-accent underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
