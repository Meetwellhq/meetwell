"use client";

import { UserRoundPlus } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { androidSaveContactIntent } from "@/lib/profiles/links";
import type { PublicProfile } from "@/lib/profiles/types";
import { track } from "./tracking";

/**
 * Saves the card to the visitor's contacts.
 * - Android: opens the Contacts app pre-filled (Chrome would only download a .vcf).
 * - iPhone and others: opens the vCard, which iOS shows as "Create New Contact".
 */
export function SaveContactButton({
  profile,
}: {
  profile: Pick<PublicProfile, "slug" | "fullName" | "title" | "organization" | "contacts">;
}) {
  const vcardPath = `/p/${profile.slug}/vcard`;

  return (
    <a
      href={vcardPath}
      className={buttonClass({ size: "lg", className: "w-full" })}
      onClick={(e) => {
        track(profile.slug, "save_contact");
        if (/android/i.test(navigator.userAgent)) {
          e.preventDefault();
          const fallback = new URL(vcardPath, window.location.origin).toString();
          window.location.href = androidSaveContactIntent(profile, fallback);
        }
      }}
    >
      <UserRoundPlus className="size-5" aria-hidden />
      Save contact
    </a>
  );
}
