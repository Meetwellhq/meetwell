import { Link2 } from "lucide-react";
import {
  siBehance,
  siDribbble,
  siFacebook,
  siGithub,
  siInstagram,
  siMedium,
  siSubstack,
  siThreads,
  siTiktok,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons";
import { cn } from "@/lib/cn";

const PATHS: Record<string, string> = {
  x: siX.path,
  instagram: siInstagram.path,
  github: siGithub.path,
  dribbble: siDribbble.path,
  behance: siBehance.path,
  youtube: siYoutube.path,
  tiktok: siTiktok.path,
  facebook: siFacebook.path,
  threads: siThreads.path,
  medium: siMedium.path,
  substack: siSubstack.path,
  whatsapp: siWhatsapp.path,
};

/** Monochrome brand glyphs (Simple Icons, CC0). Decorative: pair with a text label. */
export function SocialIcon({ platform, className }: { platform: string; className?: string }) {
  const cls = cn("size-5 shrink-0", className);

  if (platform === "linkedin") {
    // Simple Icons no longer ships LinkedIn; this is just the "in" letters (no box), so it weighs
    // about the same as the other glyphs.
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden fill="currentColor">
        <circle cx="5" cy="4.6" r="2.2" />
        <path d="M3 8.6h4V21H3zM9.5 8.6h3.8v1.7h.06c.53-1 1.82-2.05 3.75-2.05 4.01 0 4.75 2.64 4.75 6.07V21h-4v-5.88c0-1.4-.03-3.2-1.95-3.2-1.95 0-2.25 1.52-2.25 3.1V21h-4.16z" />
      </svg>
    );
  }

  const path = PATHS[platform];
  if (!path) return <Link2 className={cls} aria-hidden />;
  return (
    <svg viewBox="0 0 24 24" className={cls} aria-hidden fill="currentColor">
      <path d={path} />
    </svg>
  );
}
