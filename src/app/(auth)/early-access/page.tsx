import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { joinWaitlist } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Join early access" };

export default function EarlyAccessPage() {
  return (
    <>
      <AuthIntro title="Join early access">
        Meetwell is in private beta. Leave your name and email and we&apos;ll send you an access code as soon as a spot opens.
      </AuthIntro>
      <AuthSection>
        <AuthForm
          action={joinWaitlist}
          submitLabel="Join early access"
          hideOnMessage
          fields={[
            { name: "fullName", label: "Full name", type: "text", autoComplete: "name" },
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
          ]}
          footer={
            <p className="text-center text-xs text-ink-3">
              We&apos;ll email your invite and occasional Meetwell updates, like new members you might want to meet.
              Unsubscribe anytime. See our <Link href="/privacy" className="underline">Privacy notice</Link>.
            </p>
          }
        />
      </AuthSection>
      <AuthSection className="text-center text-sm text-ink-2">
        Have a code?{" "}
        <Link href="/access-code" className="font-medium text-accent hover:underline">
          Use your access code
        </Link>{" "}
        · Have an account?{" "}
        <Link href="/sign-in?method=email" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </AuthSection>
    </>
  );
}
