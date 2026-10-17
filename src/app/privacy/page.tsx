import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="October 17, 2026">
      <section>
        <h2>What is public</h2>
        <p>
          When you publish your card, anyone with your link or QR code can see your name, photo, title, organization,
          bio and networking goals, plus any contact methods and links you have switched to <strong>Public</strong>.
          Fields set to <strong>Private</strong> are never included in your public page, its metadata, the downloadable
          contact card (.vcf) or our public API.
        </p>
      </section>
      <section>
        <h2>What we store about you</h2>
        <ul>
          <li>Your account email and a securely hashed password (handled by our authentication provider).</li>
          <li>The profile details you enter, and your profile photo if you upload one.</li>
        </ul>
      </section>
      <section>
        <h2>What we store about visitors</h2>
        <p>
          Visitors don&apos;t need an account. To show you simple engagement totals, we record anonymous events — for
          example &ldquo;profile viewed&rdquo;, &ldquo;contact saved&rdquo; or &ldquo;message copied&rdquo; — with the
          time and whether the visit came from a QR scan. We do not store visitors&apos; IP addresses, device
          identifiers, names or the messages they write. Conversation starter drafts are generated in the visitor&apos;s
          browser and are never sent to us. Events are deleted after 13 months.
        </p>
      </section>
      <section>
        <h2>Your controls</h2>
        <ul>
          <li>Make any field public or private at any time.</li>
          <li>Unpublish your card to take it offline immediately; your link and QR code will show it as unavailable.</li>
          <li>Delete your card or your entire account from Settings. Deletion removes your profile, photo and events.</li>
        </ul>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Questions about privacy at {APP_NAME}? Email <a className="text-accent underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
