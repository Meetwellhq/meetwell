"use client";

import { UserRoundPlus } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { PublicProfile } from "@/lib/profiles/types";
import { track } from "./tracking";

/**
 * Saves the card to the visitor's contacts via a vCard.
 * - iPhone: Safari shows the contact with "Create New Contact".
 * - Android: browsers can't add contacts directly (Chrome won't launch the
 *   Contacts app from a web page), so the .vcf downloads and we explain how
 *   to finish: open it from the download notification.
 */
export function SaveContactButton({ profile }: { profile: Pick<PublicProfile, "slug" | "fullName"> }) {
  const [androidHint, setAndroidHint] = useState(false);
  const firstName = profile.fullName.split(/\s+/)[0];

  return (
    <>
      <a
        href={`/p/${profile.slug}/vcard`}
        className={buttonClass({ size: "lg", className: "w-full" })}
        onClick={() => {
          track(profile.slug, "save_contact");
          if (/android/i.test(navigator.userAgent)) setAndroidHint(true);
        }}
      >
        <UserRoundPlus className="size-5" aria-hidden />
        Save contact
      </a>
      {androidHint && (
        <p role="status" className="mt-3 rounded-xl bg-accent-soft px-3.5 py-2.5 text-left text-sm text-accent">
          Downloading {firstName}&apos;s contact. To finish, tap <strong>Open</strong> on the download message (or open
          the file from your notifications) and choose <strong>Contacts</strong>.
        </p>
      )}
    </>
  );
}
