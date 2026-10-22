"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { importDeviceCards } from "@/lib/contacts/actions";
import { clearDeviceCards, readDeviceCards } from "@/lib/contacts/device";

/** Moves cards saved on this phone (before signing up or while logged out) into Contacts, once. */
export function DeviceCardsImporter() {
  const toast = useToast();
  const router = useRouter();
  useEffect(() => {
    const cards = readDeviceCards();
    if (cards.length === 0) return;
    void importDeviceCards(cards.map(({ slug, source }) => ({ slug, source })))
      .then(({ imported }) => {
        clearDeviceCards();
        if (imported > 0) {
          toast(imported === 1 ? "1 card from your phone is now in Contacts." : `${imported} cards from your phone are now in Contacts.`);
          router.refresh();
        }
      })
      .catch(() => {});
  }, [toast, router]);
  return null;
}
