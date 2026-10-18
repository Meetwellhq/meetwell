import type { Metadata } from "next";
import Link from "next/link";
import { AccessCodeFlow } from "@/components/auth/access-code-flow";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";

export const metadata: Metadata = { title: "Use your access code" };

export default async function AccessCodePage({ searchParams }: PageProps<"/access-code">) {
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? code.slice(0, 64) : undefined;

  return (
    <>
      <AuthIntro title="Use your access code">
        Enter the code from your invite, then create your account.
      </AuthIntro>
      <AuthSection>
        <AccessCodeFlow initialCode={initialCode} />
        <p className="mt-4 text-center text-xs text-ink-3">
          By creating an account you agree to our <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy notice</Link>.
        </p>
      </AuthSection>
      <AuthSection className="text-center text-sm text-ink-2">
        No code?{" "}
        <Link href="/early-access" className="font-medium text-accent hover:underline">
          Request early access
        </Link>{" "}
        · Have an account?{" "}
        <Link href="/sign-in?method=email" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </AuthSection>
    </>
  );
}
