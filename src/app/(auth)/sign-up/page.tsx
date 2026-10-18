import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { redirect } from "next/navigation";
import { signUp } from "@/lib/auth/actions";
import { SIGNUPS_OPEN } from "@/lib/config";

export const metadata: Metadata = { title: "Create your card" };

export default function SignUpPage() {
  // Private beta: send visitors to the early-access list instead.
  if (!SIGNUPS_OPEN) redirect("/early-access");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your card</h1>
      <p className="mb-8 mt-2 text-ink-2">Free, and ready in a few minutes.</p>
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
      <p className="mt-8 text-center text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
