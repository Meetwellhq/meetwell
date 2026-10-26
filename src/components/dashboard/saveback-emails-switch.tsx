"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { setSavebackEmails } from "@/lib/contacts/actions";

export function SavebackEmailsSwitch({ initial }: { initial: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={on}
      disabled={pending}
      label="Email me when someone saves my card back"
      showState={false}
      onChange={(next) =>
        start(async () => {
          setOn(next);
          const res = await setSavebackEmails(next);
          if (res.error) {
            setOn(!next);
            toast(res.error, "error");
          } else toast(next ? "Save-back emails on." : "Save-back emails off.");
        })
      }
    />
  );
}
