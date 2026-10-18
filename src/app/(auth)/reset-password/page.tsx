import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthIntro, AuthSection } from "@/components/auth/auth-section";
import { updatePassword } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthIntro title="Choose a new password">You&apos;ll stay signed in on this device.</AuthIntro>
      <AuthSection>
        <AuthForm
          action={updatePassword}
          submitLabel="Update password"
          fields={[
            { name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 8 characters" },
            { name: "confirm", label: "Confirm password", type: "password", autoComplete: "new-password" },
          ]}
        />
      </AuthSection>
    </>
  );
}
