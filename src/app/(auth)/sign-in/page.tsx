import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthIntro, AuthSection, AUTH_BUTTON } from "@/components/auth/auth-section";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { signIn } from "@/lib/auth/actions";
import { APP_NAME, SIGNUPS_OPEN, SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Log in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next, error, method } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/dashboard";

  // Private beta: start with a choice between signing in and using an access code.
  if (!SIGNUPS_OPEN && method !== "email" && !error) {
    const emailHref = `/sign-in?method=email${typeof next === "string" ? `&next=${encodeURIComponent(next)}` : ""}`;
    return (
      <>
        <AuthIntro title={`${APP_NAME} is in private beta`}>
          We&apos;re letting people in a few at a time. Log in to your account, or use the access code from your
          invite.
        </AuthIntro>
        <AuthSection className="flex flex-col gap-3">
          <ButtonLink href={emailHref} className={AUTH_BUTTON}>
            Log in
          </ButtonLink>
          <ButtonLink href="/access-code" variant="secondary" className={AUTH_BUTTON}>
            I have an access code
          </ButtonLink>
        </AuthSection>
        <AuthSection>
          <h2 className="font-semibold text-ink">New to {APP_NAME}?</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            Leave your email and we&apos;ll send you an access code when there&apos;s room.
          </p>
          <ButtonLink href="/early-access" variant="secondary" className={`mt-5 ${AUTH_BUTTON}`}>
            Request early access
          </ButtonLink>
        </AuthSection>
      </>
    );
  }

  return (
    <>
      <AuthIntro title="Welcome back">Log in to manage your card.</AuthIntro>
      <AuthSection>
        {error === "confirmed" && (
          <Alert tone="success" className="mb-4">
            Your email is confirmed. Log in below to finish setting up your card.
          </Alert>
        )}
        {(error === "expired" || error === "link") && (
          <Alert tone="danger" className="mb-4">
            That link has expired or was already used. If you&apos;ve confirmed your email, just log in. Otherwise,{" "}
            {SIGNUPS_OPEN ? (
              <><Link href="/sign-up" className="underline">sign up again</Link> with the same email to get a new link.</>
            ) : (
              <>email <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a> and we&apos;ll send a new one.</>
            )}
          </Alert>
        )}
        {error === "reset" && (
          <Alert tone="danger" className="mb-4">
            That reset link didn&apos;t work. <Link href="/forgot-password" className="underline">Request a new one</Link> and
            open it in this same browser.
          </Alert>
        )}
        <AuthForm
          action={signIn}
          submitLabel="Log in"
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
      </AuthSection>
      <AuthSection className="text-center text-sm text-ink-2">
        {SIGNUPS_OPEN ? (
          <>
            New here?{" "}
            <Link href="/sign-up" className="font-medium text-accent hover:underline">
              Create your card
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/access-code" className="font-medium text-accent hover:underline">
              Use an access code
            </Link>{" "}
            or{" "}
            <Link href="/early-access" className="font-medium text-accent hover:underline">
              request early access
            </Link>
          </>
        )}
      </AuthSection>
    </>
  );
}
