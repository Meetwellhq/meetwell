import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Community rules" };

export default function CommunityRulesPage() {
  return (
    <LegalPage title="Community rules" updated="October 21, 2026">
      <section>
        <p>
          {APP_NAME} is for meeting people who can help your career, and helping others in return. These rules keep
          it a place people want to be. They apply to cards and to messages.
        </p>
      </section>

      <section>
        <h2>Be respectful</h2>
        <ul>
          <li>No harassment, bullying, threats or hate.</li>
          <li>No sexual messages or unwanted advances. This is a professional space.</li>
          <li>If someone doesn&apos;t reply or says no, leave it there.</li>
        </ul>
      </section>

      <section>
        <h2>Be genuine</h2>
        <ul>
          <li>Use your real name and your own photo, and describe your experience honestly.</li>
          <li>No spam, mass messages or selling.</li>
          <li>Don&apos;t ask for money, or for payment outside {APP_NAME}, and never send money to someone you met here.</li>
        </ul>
      </section>

      <section>
        <h2>Keep it private</h2>
        <ul>
          <li>Don&apos;t share someone&apos;s messages, contact details or other personal information without their OK.</li>
          <li>Don&apos;t screenshot conversations to embarrass someone.</li>
        </ul>
      </section>

      <section>
        <h2>If something goes wrong</h2>
        <ul>
          <li>
            Use <strong>Report</strong> on any message, or <strong>Block</strong> to stop someone messaging you. They
            aren&apos;t told who reported them.
          </li>
          <li>
            We look at every report. We may pause someone&apos;s messaging while we check, and close accounts that break
            these rules.
          </li>
          <li>
            If you&apos;re ever in danger, contact the police first. For anything else, write to{" "}
            <a className="text-accent underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </li>
        </ul>
      </section>
    </LegalPage>
  );
}
