import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { APP_NAME, COMPANY_NAME, COMPANY_RC, INFO_EMAIL, isSupabaseConfigured, SUPPORT_EMAIL } from "@/lib/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSparkOn } from "@/lib/spark";

export const metadata: Metadata = {
  title: "Support",
  description: `How to get help with ${APP_NAME}.`,
};

async function isSignedIn() {
  if (!isSupabaseConfigured()) return false;
  try {
    return !!(await getCurrentUser());
  } catch {
    return false;
  }
}

const mail = (
  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-ink underline decoration-border-strong underline-offset-4 hover:decoration-ink">
    {SUPPORT_EMAIL}
  </a>
);

// Reports about people and security go to the main inbox.
const infoMail = (
  <a href={`mailto:${INFO_EMAIL}`} className="text-ink underline decoration-border-strong underline-offset-4 hover:decoration-ink">
    {INFO_EMAIL}
  </a>
);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="font-display text-3xl tracking-tight text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function Items({ items }: { items: { label: string; body: ReactNode }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <span className="font-medium text-ink">{i.label}:</span> {i.body}
        </li>
      ))}
    </ul>
  );
}

export default async function SupportPage() {
  const [signedIn, spark] = await Promise.all([isSignedIn(), isSparkOn()]);

  return (
    <div className="light-only flex min-h-full flex-col bg-surface">
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-14 sm:py-20">
        <h1 className="font-display text-4xl leading-none tracking-tight text-ink sm:text-5xl">Support</h1>
        <p className="mt-5 text-ink-3">Last updated 22 October 2026.</p>

        <Section title="Get in touch">
          <p>
            Email {mail} and a real person on the {APP_NAME} team will read it. You don&apos;t need an account to
            write to us.
          </p>
          <p>We reply as soon as we can, and always within 7 days.</p>
        </Section>

        <Section title="What to include">
          <p>None of this is required, but it helps us sort things out faster:</p>
          <Items
            items={[
              { label: "What happened", body: "What you expected, and what you saw instead." },
              { label: "Where", body: "The page you were on, or the card link (meetwell.me/p/…) it's about." },
              { label: "When", body: "Roughly when it happened, so we can find it on our side." },
              { label: "Your phone or browser", body: "For example iPhone with Safari, or Android with Chrome." },
              { label: "Payments", body: "The payment reference from your receipt or from Settings → Payment history." },
            ]}
          />
        </Section>

        <Section title="What we can help with">
          <Items
            items={[
              { label: "Joining and logging in", body: "Access codes, joining through someone's card, confirming your email and resetting your password." },
              { label: "Your card and QR code", body: "Editing your card, publishing it, and QR codes or saved contacts that don't work as expected." },
              { label: "Contacts", body: "Cards that didn't show up in your Contacts, or exporting them to your phone." },
              ...(spark
                ? [{ label: "Spark", body: "Introductions you didn't get, your free introductions each month, and Spark credits." }]
                : []),
              { label: "Mentoring and payments", body: "Becoming a mentor, paying to message a mentor, refunds, earnings and withdrawals." },
              { label: "Messages and safety", body: "Blocking, reporting someone, or anything that broke our community rules." },
              {
                label: "Your data",
                body: (
                  <>
                    Requests to see, correct, export or delete your data. Our{" "}
                    <Link href="/privacy" className="text-ink underline decoration-border-strong underline-offset-4">
                      Privacy notice
                    </Link>{" "}
                    explains what we hold.
                  </>
                ),
              },
            ]}
          />
        </Section>

        <Section title="Refunds">
          <p>
            {spark && "Unused Spark credits bought in the last 14 days can be refunded. "}If a mentor doesn&apos;t reply within 7
            days of your payment, you get a full refund. Email {mail} with your payment reference. Our{" "}
            <Link href="/terms" className="text-ink underline decoration-border-strong underline-offset-4">
              Terms
            </Link>{" "}
            have the details.
          </p>
        </Section>

        <Section title="Reporting someone">
          <p>
            In a conversation, use <span className="font-medium text-ink">Report</span> on any message, or block the
            person. For anything urgent, or a card that pretends to be someone else, email {infoMail}.
          </p>
        </Section>

        <Section title="Reporting a security issue">
          <p>
            If you think you&apos;ve found a security problem, email {infoMail} with the details, and please give us a
            chance to fix it before sharing it publicly. We&apos;ll confirm we got your report within 2 working days.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            {APP_NAME} is run by {COMPANY_NAME} ({COMPANY_RC}), Lagos, Nigeria. For anything at all, support, safety or
            a question about your data, write to {mail}.
          </p>
        </Section>
      </main>
      <SiteFooter wide />
    </div>
  );
}
