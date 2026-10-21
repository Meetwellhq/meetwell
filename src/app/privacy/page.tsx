import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy notice" };

const mail = (
  <a className="text-accent underline" href={`mailto:${SUPPORT_EMAIL}`}>
    {SUPPORT_EMAIL}
  </a>
);

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="October 21, 2026">
      <section>
        <p>
          This notice explains what personal data {APP_NAME} collects, why, and the rights you have. We follow the
          Nigeria Data Protection Act 2023 (NDPA) and respect your right to privacy under section 37 of the
          Constitution of the Federal Republic of Nigeria 1999 (as amended).
        </p>
        <p className="mt-3">
          {APP_NAME}, operated from Lagos, Nigeria, is the data controller. For anything about your data, email {mail}.
        </p>
      </section>

      <section>
        <h2>1. What we collect</h2>
        <p>
          <strong>If you join the waiting list:</strong> your name, email address and the date you joined.
        </p>
        <p className="mt-3">
          <strong>If you create an account:</strong>
        </p>
        <ul>
          <li>your email address and password (the password is stored only as a secure hash);</li>
          <li>
            what you add to your card: name, photo, job title, organisation, bio, networking goal, contact details and
            links;
          </li>
          <li>whether each contact detail or link is Public or Private.</li>
        </ul>
        <p className="mt-3">
          <strong>If you turn on Spark (our AI matching feature):</strong> your field, years of experience, what you&apos;re looking
          for and your city, plus a record of the matches we send you. These details are private and aren&apos;t shown
          on your card.
        </p>
        <p className="mt-3">
          <strong>Access codes:</strong> we check your code when you sign up and count how many times it has been used.
          We don&apos;t keep a record of which code you used on your account.
        </p>
        <p className="mt-3">
          <strong>When someone opens a card:</strong> visitors don&apos;t need an account. We record simple events
          such as &ldquo;card viewed&rdquo;, &ldquo;contact saved&rdquo; or &ldquo;message copied&rdquo;, with the time
          and whether it came from a QR scan. We don&apos;t store visitors&apos; names, IP addresses or device IDs with
          these events. Suggested first messages are written in the visitor&apos;s browser and never sent to us.
        </p>
        <p className="mt-3">
          <strong>Technical logs:</strong> our hosting and login providers keep short-lived logs, which can include IP
          addresses, to keep the service secure and fix problems.
        </p>
      </section>

      <section>
        <h2>2. What is public</h2>
        <p>
          When you publish your card, anyone with your link or QR code can see your name, photo, title, organisation,
          bio and networking goal, plus any contact details and links set to <strong>Public</strong>. Anything set to{" "}
          <strong>Private</strong> is never shown on your page, in its preview, in the downloadable contact file or in
          our public API. Once someone saves your contact to their phone, we can&apos;t remove it from there.
        </p>
      </section>

      <section>
        <h2>3. Why we use it, and our lawful basis</h2>
        <ul>
          <li>
            <strong>To run your account and card</strong>, because it is needed for our agreement with you (our{" "}
            <Link href="/terms" className="text-accent underline">Terms of use</Link>).
          </li>
          <li>
            <strong>To send your waiting-list confirmation and invite</strong>, because you asked us to by joining.
          </li>
          <li>
            <strong>To send occasional Meetwell updates to the waiting list</strong>, such as new members you might
            want to meet, as we tell you when you join. Every update has an <strong>Unsubscribe</strong> link, and
            unsubscribing won&apos;t affect your invite.
          </li>
          <li>
            <strong>To send account emails</strong>, such as confirming your email or resetting your password, as part
            of providing the service.
          </li>
          <li>
            <strong>To show you engagement totals and keep the service secure</strong>, based on our legitimate
            interest in running a safe, working product.
          </li>
          <li>
            <strong>To recommend people for you to meet (Spark)</strong>, only if you turn it on. We
            compare your matching details, job title and bio with other members who also turned it on, and use AI to
            choose a match and explain why. When you&apos;re recommended to someone, they see your public card and the
            reason, never your private matching details. You can turn Spark off anytime on your Spark page.
          </li>
          <li><strong>To meet legal obligations</strong>, where Nigerian law requires it.</li>
        </ul>
        <p className="mt-3">
          We don&apos;t sell your data, and we don&apos;t share it with other companies for their advertising.
        </p>
      </section>

      <section>
        <h2>4. Who we share it with</h2>
        <p>We use a few trusted providers to run {APP_NAME}. They only process data on our instructions:</p>
        <ul>
          <li><strong>Supabase</strong>: database, file storage and login;</li>
          <li><strong>Vercel</strong>: website hosting;</li>
          <li><strong>Resend</strong>: sending emails;</li>
          <li>
            <strong>Anthropic</strong> (Claude): choosing matches and writing the reason, for members who turn on
            Spark. Only the profile details needed for matching are sent.
          </li>
        </ul>
        <p className="mt-3">
          We may also share data if the law requires it, for example under a valid court order.
        </p>
      </section>

      <section>
        <h2>5. Data stored outside Nigeria</h2>
        <p>
          These providers store data on servers outside Nigeria. Where that happens, we rely on the safeguards allowed
          under Part VIII of the NDPA, such as the providers&apos; contractual data protection commitments, so your
          data stays protected to a standard the NDPA accepts.
        </p>
      </section>

      <section>
        <h2>6. How long we keep it</h2>
        <ul>
          <li><strong>Account and card:</strong> until you delete them.</li>
          <li><strong>Engagement events:</strong> up to 13 months, then deleted.</li>
          <li>
            <strong>Waiting-list name and email:</strong> until you have been invited and created an account, or until you ask us
            to remove it.
          </li>
          <li><strong>Technical logs:</strong> a short period set by our providers.</li>
        </ul>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>Under the NDPA you can:</p>
        <ul>
          <li>ask for a copy of the personal data we hold about you;</li>
          <li>correct data that is wrong or incomplete;</li>
          <li>ask us to delete your data;</li>
          <li>object to, or ask us to limit, how we use it;</li>
          <li>ask for your data in a format you can take elsewhere;</li>
          <li>withdraw consent at any time, for example to unsubscribe from updates or leave the waiting list;</li>
          <li>complain to the Nigeria Data Protection Commission (NDPC).</li>
        </ul>
        <p className="mt-3">
          Most of this you can do yourself in your dashboard. For anything else, email {mail}. We will respond within 30
          days and won&apos;t charge you.
        </p>
      </section>

      <section>
        <h2>8. Your controls</h2>
        <ul>
          <li>Switch any contact detail or link between Public and Private at any time.</li>
          <li>Unpublish your card to take it offline at once. Your link and QR code will show it as unavailable.</li>
          <li>Delete your card or your whole account from Settings. This removes your profile, photo and events.</li>
        </ul>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>
          We use encrypted connections (HTTPS), hashed passwords, and database rules that stop one user from reading
          another user&apos;s private data. If a breach puts your rights at risk, we will notify the NDPC within 72
          hours as the NDPA requires, and tell you without undue delay.
        </p>
      </section>

      <section>
        <h2>10. Cookies</h2>
        <p>
          We only use the cookies needed to keep you logged in. We don&apos;t use advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>11. Children</h2>
        <p>
          {APP_NAME} is for people aged 18 and over. We don&apos;t knowingly collect data from children. If you
          believe a child has given us their details, email {mail} and we will delete them.
        </p>
      </section>

      <section>
        <h2>12. Changes to this notice</h2>
        <p>
          If we make important changes, we will email you before they take effect and update the date at the top of
          this page.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>Questions or requests about your data? Email {mail}.</p>
      </section>
    </LegalPage>
  );
}
