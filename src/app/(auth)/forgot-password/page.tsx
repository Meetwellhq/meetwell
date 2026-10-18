import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { requestPasswordReset } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthIntro title="Reset your password">We&apos;ll email you a link to choose a new one.</AuthIntro>
      <AuthSection>
        <AuthForm
          action={requestPasswordReset}
          submitLabel="Send reset link"
          hideOnMessage
          fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
        />
      </AuthSection>
      <AuthSection className="text-center text-sm">
        <Link href="/sign-in?method=email" className="font-medium text-accent hover:underline">
          Back to log in
        </Link>
      </AuthSection>
    </>
  );
}
