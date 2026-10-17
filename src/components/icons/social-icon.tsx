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
    // Simple Icons no longer ships LinkedIn; this is a neutral "in" monogram.
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden fill="currentColor">
        <path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm1.6 7.4V19h3V9.4h-3Zm1.5-4.6a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM10.6 9.4V19h3v-5c0-1.4.6-2.4 1.9-2.4 1.2 0 1.6.9 1.6 2.3V19h3v-5.7c0-2.8-1.4-4.1-3.5-4.1-1.5 0-2.4.7-2.9 1.5h-.1V9.4h-3Z" />
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
