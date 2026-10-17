import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { requestPasswordReset } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-8 mt-2 text-ink-2">We&apos;ll email you a link to choose a new one.</p>
      <AuthForm
        action={requestPasswordReset}
        submitLabel="Send reset link"
        hideOnMessage
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      />
      <p className="mt-8 text-center text-sm text-ink-2">
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
