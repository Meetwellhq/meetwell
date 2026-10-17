import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { updatePassword } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mb-8 mt-2 text-ink-2">You&apos;ll stay signed in on this device.</p>
      <AuthForm
        action={updatePassword}
        submitLabel="Update password"
        fields={[
          { name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 8 characters" },
          { name: "confirm", label: "Confirm password", type: "password", autoComplete: "new-password" },
        ]}
      />
    </>
  );
}
