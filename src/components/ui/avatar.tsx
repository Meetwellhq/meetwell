import { cn } from "@/lib/cn";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) {
    return (
      // Supabase Storage URLs are user content on a dynamic host, so a plain img is used.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={cn("rounded-full object-cover", className)} />
    );
  }
  return (
    <div
      role="img"
      aria-label={name}
      className={cn("grid place-items-center rounded-full bg-accent-soft font-semibold text-accent", className)}
    >
      <span aria-hidden>{initials(name)}</span>
    </div>
  );
}
