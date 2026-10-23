"use client";

import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "@/lib/auth/actions";
import { readDeviceCards, type DeviceCard } from "@/lib/contacts/device";

/**
 * Sign-up through someone's card or a partner's link. Sends the invite and the
 * cards saved on this phone, so they're in the new member's Contacts straight away.
 */
export function JoinForm({ viaCard = "", viaPartner = "" }: { viaCard?: string; viaPartner?: string }) {
  const [cards, setCards] = useState<DeviceCard[]>([]);
  // Phone storage can only be read once the page runs on the phone.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCards(readDeviceCards()), []);
  const others = cards.filter((c) => c.slug !== viaCard);

  return (
    <div className="flex flex-col gap-4">
      {cards.length > 0 && (
        <div className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {cards.length === 1 ? "1 card" : `${cards.length} cards`} saved on this phone will be in your contacts
          {others.length > 0 && <>: {cards.slice(0, 3).map((c) => c.name.split(/\s+/)[0]).join(", ")}{cards.length > 3 && " and more"}</>}.
        </div>
      )}
      <AuthForm
        action={signUp}
        confirmAge
        submitLabel="Create my free card"
        hideOnMessage
        hidden={{ viaCard, viaPartner, savedCards: JSON.stringify(cards.map((c) => c.slug)) }}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 8 characters" },
        ]}
      />
    </div>
  );
}
