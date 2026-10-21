import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { adminSignIn } from "@/lib/auth/actions";
import { APP_NAME } from "@/lib/config";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin log in", robots: { index: false, follow: false } };

/** The admin area's own log-in page. Member accounts are refused here. */
export default async function AdminSignInPage() {
  if (await getCurrentUser()) {
    const { data: isAdmin } = await (await createClient()).rpc("is_admin");
    if (isAdmin === true) redirect("/admin");
  }

  return (
    <>
      <AuthIntro title={`${APP_NAME} Admin`}>For running {APP_NAME}. Member accounts can&apos;t log in here.</AuthIntro>
      <AuthSection>
        <AuthForm
          action={adminSignIn}
          submitLabel="Log in to admin"
          fields={[
            { name: "email", label: "Admin email", type: "email", autoComplete: "username" },
            { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
          ]}
        />
      </AuthSection>
    </>
  );
}
