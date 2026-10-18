import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { signUp } from "@/lib/auth/actions";
import { SIGNUPS_OPEN } from "@/lib/config";

export const metadata: Metadata = { title: "Create your card" };

export default function SignUpPage() {
  // Private beta: new accounts need an access code; the sign-in page offers that.
  if (!SIGNUPS_OPEN) redirect("/sign-in");

  return (
    <>
      <AuthIntro title="Create your card">Free, and ready in a few minutes.</AuthIntro>
      <AuthSection>
        <AuthForm
          action={signUp}
          submitLabel="Create account"
          hideOnMessage
          fields={[
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 8 characters" },
          ]}
          footer={
            <p className="text-center text-xs text-ink-3">
              By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and{" "}
              <Link href="/privacy" className="underline">Privacy notice</Link>.
            </p>
          }
        />
      </AuthSection>
      <AuthSection className="text-center text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </AuthSection>
    </>
  );
}
