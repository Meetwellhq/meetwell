"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { saveExperience } from "@/lib/matching/actions";
import { type Experience, ExperienceFields } from "./experience-fields";

const DISMISSED_KEY = "meetwell:experience-prompt-dismissed";
const ASK_AGAIN_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return !!at && Date.now() - at < ASK_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

/**
 * Pop-up for members who haven't told us their years of experience yet (they
 * joined before sign-up asked). "Maybe later" hides it for 3 days. Not shown on
 * the Spark page, which asks in the page itself.
 */
export function ExperiencePrompt({ initialField, spark = true }: { initialField: string | null; spark?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Experience>({ field: initialField ?? "", experienceYears: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const onSparkPage = pathname.startsWith("/dashboard/matches");

  // Browser storage is only available after mount, so decide here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(!dismissedRecently()), []);

  const later = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
    setOpen(false);
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveExperience(value);
      setErrors(res.fieldErrors ?? {});
      setError(res.error ?? null);
      if (res.ok) {
        setOpen(false);
        toast("Thanks! Meetwell is now set up for you.");
        router.refresh();
      }
    });

  return (
    <Dialog
      open={open && !onSparkPage}
      onClose={later}
      title="How many years of experience do you have?"
      description={
        spark
          ? "Tell us and we'll personalise Meetwell for you, so you get the most out of Spark, our introductions feature."
          : "Tell us and we'll set Meetwell up for you, including mentoring if you have 4 or more years."
      }
    >
      <ExperienceFields value={value} onChange={setValue} errors={errors} spark={spark} />
      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={later}>
          Maybe later
        </Button>
        <Button onClick={save} loading={pending}>
          Save
        </Button>
      </div>
    </Dialog>
  );
}
