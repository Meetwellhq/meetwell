import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { joinWaitlist } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Join early access" };

export default function EarlyAccessPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Join early access</h1>
      <p className="mb-8 mt-2 text-ink-2">
        Meetwell is in private beta. Leave your email and we&apos;ll invite you as soon as a spot opens.
      </p>
      <AuthForm
        action={joinWaitlist}
        submitLabel="Join early access"
        hideOnMessage
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
        footer={
          <p className="text-center text-xs text-ink-3">
            We&apos;ll only use your email to send your invite. See our{" "}
            <Link href="/privacy" className="underline">Privacy notice</Link>.
          </p>
        }
      />
      <p className="mt-8 text-center text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
