import {
  ChevronRight,
  ExternalLink,
  Handshake,
  IdCard,
  LogOut,
  QrCode,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/misc";
import { signOut } from "@/lib/auth/actions";
import { publicProfilePath } from "@/lib/config";
import { isMentor } from "@/lib/matching/constants";
import { getOwnProfile } from "@/lib/profiles/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile" };

type Row = { href: string; label: string; icon: LucideIcon; note?: string; external?: boolean };

function Group({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-sm text-ink-3">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {rows.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              target={r.external ? "_blank" : undefined}
              className="flex items-center gap-3 px-4 py-3.5 text-ink hover:bg-surface-2"
            >
              <r.icon className="size-5 shrink-0 text-ink-2" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.label}</span>
                {r.note && <span className="block truncate text-sm text-ink-3">{r.note}</span>}
              </span>
              {r.external ? (
                <ExternalLink className="size-4 shrink-0 text-ink-3" aria-hidden />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The Profile tab on phones: your card at the top, then Edit card, QR code,
 * Settings (plus Spark for mentors and Partner for partner teams), and Log out.
 */
export default async function ProfileHubPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getOwnProfile()]);
  if (!profile) redirect("/onboarding");
  const supabase = await createClient();
  const [{ data: years }, { data: partners }] = await Promise.all([
    supabase.from("profiles").select("experience_years").eq("id", profile.id).maybeSingle(),
    supabase.rpc("my_partners"),
  ]);
  const live = profile.status === "published";
  const subtitle = [profile.title, profile.organization].filter(Boolean).join(" · ");

  const card: Row[] = [
    { href: "/dashboard/profile", label: "Edit card", icon: IdCard, note: "Photo, bio, contacts and links" },
    { href: "/dashboard/qr", label: "QR code", icon: QrCode, note: "Show, share or download it" },
    ...(live ? [{ href: publicProfilePath(profile.slug), label: "View my card", icon: ExternalLink, external: true }] : []),
  ];
  const more: Row[] = [
    // Mentors have Mentoring in the bottom bar instead of Spark, so Spark lives here for them.
    ...(isMentor(years?.experience_years)
      ? [{ href: "/dashboard/matches", label: "Spark", icon: Sparkles, note: "How often you're introduced" }]
      : []),
    ...((partners ?? []).length > 0 ? [{ href: "/dashboard/partner", label: "Partner", icon: Handshake }] : []),
    { href: "/dashboard/settings", label: "Settings", icon: Settings, note: "Account, emails, appearance, payments" },
  ];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar name={profile.fullName} src={profile.avatarUrl} className="size-16 text-lg" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{profile.fullName}</h1>
            {!live && <Badge tone="warning">Draft</Badge>}
          </div>
          {subtitle && <p className="truncate text-ink-2">{subtitle}</p>}
          <p className="truncate text-sm text-ink-3">{user?.email}</p>
        </div>
      </div>

      <Group title="Your card" rows={card} />
      <Group title="More" rows={more} />

      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 font-medium text-danger hover:bg-danger/10"
        >
          <LogOut className="size-5" aria-hidden />
          Log out
        </button>
      </form>
    </div>
  );
}
