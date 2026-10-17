import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Alert } from "@/components/ui/misc";
import { signIn } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/dashboard";

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 mt-2 text-ink-2">Sign in to manage your card.</p>
      {error === "link" && (
        <Alert tone="danger" className="mb-4">
          That link is invalid or has expired. Please sign in or request a new link.
        </Alert>
      )}
      <AuthForm
        action={signIn}
        submitLabel="Sign in"
        hidden={{ next: nextPath }}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
        footer={
          <Link href="/forgot-password" className="text-center text-sm text-ink-2 hover:text-ink">
            Forgot your password?
          </Link>
        }
      />
      <p className="mt-8 text-center text-sm text-ink-2">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-accent hover:underline">
          Create your card
        </Link>
      </p>
    </>
  );
}
