"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { setMessageEmails } from "@/lib/messaging/actions";

export function MessageEmailsSwitch({ initial }: { initial: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={on}
      disabled={pending}
      label="Email me about new conversations"
      onChange={(next) =>
        start(async () => {
          setOn(next);
          const res = await setMessageEmails(next);
          if (res.error) {
            setOn(!next);
            toast(res.error, "error");
          } else toast(next ? "Message emails on." : "Message emails off.");
        })
      }
    />
  );
}
