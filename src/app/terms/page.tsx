import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { APP_NAME, COMPANY_NAME, COMPANY_RC, SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Terms of use" };

const mail = (
  <a className="text-accent underline" href={`mailto:${SUPPORT_EMAIL}`}>
    {SUPPORT_EMAIL}
  </a>
);

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="October 21, 2026">
      <section>
        <p>
          These terms are an agreement between you and {COMPANY_NAME} ({COMPANY_RC}), the company that runs{" "}
          {APP_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;), operating from Lagos, Nigeria. They apply when you create an account, publish a card, or open someone&apos;s card on
          meetwell.me. By creating an account you accept them. If you don&apos;t agree, please don&apos;t use{" "}
          {APP_NAME}.
        </p>
        <p className="mt-3">
          Accepting online, by ticking or clicking to create your account, is a valid electronic acceptance under the
          Evidence Act 2011. Please also read our <Link href="/privacy" className="text-accent underline">Privacy notice</Link>,
          which forms part of these terms.
        </p>
      </section>

      <section>
        <h2>1. Who can use {APP_NAME}</h2>
        <ul>
          <li>You must be at least 18 years old and able to enter into a binding contract.</li>
          <li>
            {APP_NAME} is in private beta. New accounts need an access code. Codes are for the person they were sent
            to. Don&apos;t sell or publish them. We may withdraw a code at any time.
          </li>
          <li>If you use {APP_NAME} for a business, you confirm you are authorised to accept these terms for it.</li>
        </ul>
      </section>

      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>Give accurate details and keep your email address up to date.</li>
          <li>Keep your password private. You are responsible for what happens under your account.</li>
          <li>Tell us straight away at {mail} if you think someone else has accessed it.</li>
        </ul>
      </section>

      <section>
        <h2>3. Your card</h2>
        <ul>
          <li>
            You own what you put on your card. You give us a non-exclusive, royalty-free licence to store, display and
            format it (including as a QR code, a public page and a downloadable contact file) only so we can run{" "}
            {APP_NAME} for you. The licence ends when you delete the content or your account.
          </li>
          <li>
            Anything you mark as Public can be seen and saved by anyone with your link or QR code. Once someone saves
            your contact, we can&apos;t remove it from their phone.
          </li>
          <li>
            Only publish details about yourself, and only what you have the right to share. Don&apos;t put another
            person&apos;s phone number, email or photo on your card without their consent.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. What you must not do</h2>
        <p>You must not use {APP_NAME} to:</p>
        <ul>
          <li>pretend to be another person or organisation, or misstate who you work for;</li>
          <li>send spam or bulk unsolicited messages, or collect people&apos;s contact details for marketing lists;</li>
          <li>harass, threaten, stalk or defraud anyone, or do anything that is an offence under the Cybercrimes
            (Prohibition, Prevention, etc.) Act 2015, as amended;</li>
          <li>publish content that is unlawful, defamatory, obscene, hateful, or that infringes someone else&apos;s
            rights, including copyright and trademarks;</li>
          <li>copy, scrape or download cards in bulk, or try to get around our security or usage limits;</li>
          <li>upload viruses or harmful code, or interfere with how the service runs.</li>
        </ul>
      </section>

      <section>
        <h2>5. Messages between people</h2>
        <p>
          {APP_NAME} can suggest a first message, but visitors send it from their own email, WhatsApp or other app. We
          are not a party to those conversations and we don&apos;t see them. Treat people you meet with the same care
          you would anywhere else.
        </p>
      </section>

      <section>
        <h2>6. Your privacy</h2>
        <p>
          We handle personal data in line with the Nigeria Data Protection Act 2023 and respect your right to privacy
          under section 37 of the Constitution of the Federal Republic of Nigeria 1999 (as amended). Our{" "}
          <Link href="/privacy" className="text-accent underline">Privacy notice</Link> explains what we collect, why,
          and how you can see, correct or delete it. You can also complain to the Nigeria Data Protection Commission.
        </p>
      </section>

      <section>
        <h2>7. Price, payments and refunds</h2>
        <ul>
          <li>
            {APP_NAME} is free to use. Some extras cost money, such as Spark credits. We show the price in naira
            before you pay, and you will never be charged without agreeing to it.
          </li>
          <li>
            <strong>Spark credits:</strong> each credit gives you one extra Spark introduction after your free ones
            for the month. Credits don&apos;t expire, can&apos;t be exchanged for cash and can&apos;t be moved to
            another account. Spark chooses who to introduce, so a credit buys an introduction, not a particular person
            or a reply.
          </li>
          <li>
            <strong>Payments</strong> are handled by Paystack. We never see or store your card or bank details.
          </li>
          <li>
            <strong>Refunds:</strong> if you change your mind, we will refund unused credits bought in the last 14
            days. Just email {mail}. Credits already used can&apos;t be refunded, unless the introduction failed
            because of a fault on our side. This doesn&apos;t affect your rights under the Federal Competition and
            Consumer Protection Act 2018.
          </li>
          <li>
            We may add, change or remove features. If a change takes away something important, we will try to give
            you reasonable notice.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Our name and software</h2>
        <p>
          The {APP_NAME} name, logo, design and software belong to us. These terms don&apos;t give you any right to use
          them, except to use the service as intended.
        </p>
      </section>

      <section>
        <h2>9. Suspending or closing accounts</h2>
        <ul>
          <li>You can unpublish your card or delete your account at any time from Settings.</li>
          <li>
            If you break these terms, we may unpublish your card or suspend your account. Unless the law or an urgent
            risk to others requires us to act at once, we will tell you why and give you a chance to respond first.
          </li>
          <li>If you think we made a mistake, email {mail} and we will review it.</li>
        </ul>
      </section>

      <section>
        <h2>10. The service is provided as is</h2>
        <p>
          We work to keep {APP_NAME} available and secure, but during the beta it may have bugs or downtime. To the
          extent the law allows, we provide it &ldquo;as is&rdquo; and without promises that it will always be
          available or error-free. Nothing in these terms takes away your rights under the Federal Competition and
          Consumer Protection Act 2018 or any other law that protects consumers.
        </p>
      </section>

      <section>
        <h2>11. Limits on our liability</h2>
        <ul>
          <li>
            We are not liable for indirect or unforeseeable losses, such as lost business, lost opportunities or lost
            profits, or for what other people do with details you choose to make public.
          </li>
          <li>
            Our total liability to you for any claim is limited to the greater of the amount you paid us in the 12
            months before the claim, or ₦50,000.
          </li>
          <li>
            These limits don&apos;t apply to death or personal injury caused by our negligence, to fraud, or to any
            liability the law does not allow us to limit.
          </li>
        </ul>
      </section>

      <section>
        <h2>12. Your responsibility to us</h2>
        <p>
          If someone brings a claim against us because of content you published or because you broke these terms, you
          agree to cover our reasonable costs of dealing with it, to the extent the law allows.
        </p>
      </section>

      <section>
        <h2>13. Complaints and disputes</h2>
        <ul>
          <li>Please contact us first at {mail}. We aim to reply within 7 days and resolve complaints within 30 days.</li>
          <li>
            If we can&apos;t resolve it together, either of us may suggest mediation, for example at the Lagos
            Multi-Door Courthouse, under the Arbitration and Mediation Act 2023.
          </li>
          <li>
            Otherwise, disputes will be decided by the courts of Lagos State, Nigeria. This doesn&apos;t stop you
            complaining to the Federal Competition and Consumer Protection Commission or the Nigeria Data Protection
            Commission.
          </li>
        </ul>
      </section>

      <section>
        <h2>14. Governing law</h2>
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria, including the Constitution of the
          Federal Republic of Nigeria 1999 (as amended).
        </p>
      </section>

      <section>
        <h2>15. Changes to these terms</h2>
        <p>
          We may update these terms as {APP_NAME} grows. For important changes, we will email you at least 14 days
          before they take effect. If you keep using {APP_NAME} after that, the new terms apply. If you don&apos;t
          agree, you can delete your account before then.
        </p>
      </section>

      <section>
        <h2>16. General</h2>
        <ul>
          <li>These terms and the Privacy notice are the whole agreement between us about {APP_NAME}.</li>
          <li>If a court finds part of these terms invalid, the rest still applies.</li>
          <li>If we don&apos;t enforce a term straight away, we can still enforce it later.</li>
          <li>
            We are not responsible for delays or failures caused by events outside our reasonable control, such as
            power or internet outages, or actions of government.
          </li>
          <li>You may not transfer your account to someone else. We may transfer these terms if {APP_NAME} is sold or
            reorganised, and we will tell you if that happens.</li>
        </ul>
      </section>

      <section>
        <h2>17. Contact</h2>
        <p>Questions about these terms? Email {mail}.</p>
      </section>
    </LegalPage>
  );
}
