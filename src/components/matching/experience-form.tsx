"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { saveExperience } from "@/lib/matching/actions";
import { type Experience, ExperienceFields } from "./experience-fields";

/** Shown on the Spark page to members who haven't told us their experience yet. */
export function ExperienceForm({ initial }: { initial: Experience }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = await saveExperience(value);
      setErrors(res.fieldErrors ?? {});
      setError(res.error ?? null);
      if (res.ok) router.refresh();
    });

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5">
      <div>
        <p className="font-medium text-ink">First, a little about your work</p>
        <p className="mt-0.5 text-sm text-ink-2">
          Spark works differently depending on your experience, so we need this before you start.
        </p>
      </div>
      <ExperienceFields value={value} onChange={setValue} errors={errors} />
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <Button onClick={save} loading={pending}>
          Continue
        </Button>
      </div>
    </section>
  );
}
