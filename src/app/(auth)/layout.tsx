import { Logo } from "@/components/marketing/logo";
import { Alert } from "@/components/ui/misc";
import { isSupabaseConfigured } from "@/lib/config";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Logo />
      <div className="mt-10 w-full max-w-sm">
        {!isSupabaseConfigured() && (
          <Alert tone="danger" className="mb-4">
            Supabase isn&apos;t configured yet. Add your project keys to <code>.env.local</code> (see the README).
          </Alert>
        )}
        {children}
      </div>
    </main>
  );
}
