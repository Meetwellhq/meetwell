"use client";

import { ArrowLeft, ArrowRight, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type Experience, ExperienceFields } from "@/components/matching/experience-fields";
import { ProfileView } from "@/components/profile/profile-view";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { saveExperience } from "@/lib/matching/actions";
import { saveProfile } from "@/lib/profiles/actions";
import type { OwnProfile } from "@/lib/profiles/types";
import { BasicsSection, ContactSection, GoalsSection, SocialSection } from "./sections";
import { toFormValues, toInput, toPreview, type Errors, type FormValues } from "./types";

type Props = {
  mode: "onboarding" | "edit";
  initial: OwnProfile | null;
  userId: string;
  email: string | null;
  siteHost: string;
  /** Years of experience and field (saved separately from the card; never shown on it). */
  initialExperience?: Experience;
};

const STEPS = [
  { key: "basics", title: "About you", description: "The essentials people see first.", fields: ["fullName", "slug", "title", "organization", "bio", "avatarUrl"] },
  { key: "experience", title: "Your experience", description: "This decides how Spark works for you.", fields: [] },
  { key: "contact", title: "How to reach you", description: "Choose what's public. You can change this any time.", fields: ["contacts", "websiteUrl"] },
  { key: "social", title: "Your links", description: "Where people can see your work.", fields: ["socials"] },
  { key: "goals", title: "What you're open to", description: "Optional, but it makes first messages more relevant.", fields: ["networkingGoals"] },
  { key: "preview", title: "Preview and publish", description: "This is exactly what people see when they scan your code.", fields: [] },
] as const;

function stepOf(errorKey: string) {
  const idx = STEPS.findIndex((s) => (s.fields as readonly string[]).some((f) => errorKey === f || errorKey.startsWith(`${f}.`)));
  return idx === -1 ? 0 : idx;
}

export function ProfileEditor({ mode, initial, userId, email, siteHost, initialExperience }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(() => toFormValues(initial, email));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showPreview, setShowPreview] = useState(false);
  const [experience, setExperience] = useState<Experience>(initialExperience ?? { field: "", experienceYears: "" });
  const [experienceErrors, setExperienceErrors] = useState<Errors>({});
  const [experienceDirty, setExperienceDirty] = useState(false);
  const changeExperience = (next: Experience) => {
    setExperience(next);
    setExperienceErrors({});
    setExperienceDirty(true);
    setDirty(true);
  };

  const slugLocked = !!initial?.publishedAt;

  const set: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(next)) if (k === key || k.startsWith(`${key}.`)) delete next[k];
      return next;
    });
  };

  async function submit(publish: boolean) {
    setFormError(null);
    const result = await saveProfile(toInput(values), { publish });
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      return { ok: false, fieldErrors: result.fieldErrors ?? {} };
    }
    setErrors({});
    setDirty(false);
    if (result.slug !== values.slug) setValues((v) => ({ ...v, slug: result.slug }));
    return { ok: true, fieldErrors: {} };
  }

  // ----- Onboarding: one step at a time, saving a draft as you go -----
  if (mode === "onboarding") {
    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    const next = () =>
      startTransition(async () => {
        if (step === 0 && !values.fullName.trim()) {
          setErrors({ fullName: "Enter your name" });
          return;
        }
        const res = await submit(false);
        if (!res.ok) {
          // Jump back to the step that holds the first error.
          const first = Object.keys(res.fieldErrors)[0];
          if (first) setStep((s) => Math.min(s, stepOf(first)));
          return;
        }
        if (current.key === "experience") {
          const saved = await saveExperience(experience);
          setExperienceErrors(saved.fieldErrors ?? {});
          if (!saved.ok) {
            if (saved.error) setFormError(saved.error);
            return;
          }
        }
        setStep((s) => s + 1);
        window.scrollTo({ top: 0 });
      });

    const publish = () =>
      startTransition(async () => {
        const res = await submit(true);
        if (res.ok) {
          toast("Your card is live.");
          router.push("/dashboard?published=1");
        }
      });

    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between text-sm text-ink-3">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{current.title}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Setup progress">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{current.title}</h1>
        <p className="mt-1 text-ink-2">{current.description}</p>

        {formError && <Alert tone="danger" className="mt-6">{formError}</Alert>}

        <div className="mt-8">
          {current.key === "basics" && <BasicsSection values={values} errors={errors} set={set} userId={userId} slugLocked={slugLocked} siteHost={siteHost} />}
          {current.key === "experience" && (
            <ExperienceFields value={experience} onChange={changeExperience} errors={experienceErrors} />
          )}
          {current.key === "contact" && <ContactSection values={values} errors={errors} set={set} />}
          {current.key === "social" && <SocialSection values={values} errors={errors} set={set} />}
          {current.key === "goals" && <GoalsSection values={values} errors={errors} set={set} />}
          {current.key === "preview" && (
            <div className="rounded-3xl bg-surface-2 p-3 sm:p-6">
              <ProfileView profile={toPreview(values)} preview />
            </div>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-6">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending} icon={<ArrowLeft className="size-4" />}>
            Back
          </Button>
          {isLast ? (
            <Button size="lg" onClick={publish} loading={pending}>
              Publish my card
            </Button>
          ) : (
            <Button onClick={next} loading={pending}>
              {step === STEPS.length - 2 ? "Preview" : "Continue"}
              {!pending && <ArrowRight className="size-4" />}
            </Button>
          )}
        </div>
        {isLast && (
          <p className="mt-3 text-right text-xs text-ink-3">Your link becomes permanent once published. You can unpublish any time.</p>
        )}
      </div>
    );
  }

  // ----- Edit mode: all sections with a live preview -----
  const save = () =>
    startTransition(async () => {
      // Experience is saved on its own, and only when changed (older cards may not have it yet).
      if (experienceDirty) {
        const saved = await saveExperience(experience);
        setExperienceErrors(saved.fieldErrors ?? {});
        if (!saved.ok) {
          toast(saved.error ?? "Please fix your experience details.", "error");
          return;
        }
        setExperienceDirty(false);
      }
      const res = await submit(false);
      if (res.ok) {
        toast(initial?.status === "published" ? "Saved. Your public card is updated." : "Saved.");
        router.refresh();
      } else {
        toast("Please fix the highlighted fields.", "error");
      }
    });

  const sections = [
    { title: "About you", body: <BasicsSection values={values} errors={errors} set={set} userId={userId} slugLocked={slugLocked} siteHost={siteHost} /> },
    {
      title: "Your experience",
      body: <ExperienceFields value={experience} onChange={changeExperience} errors={experienceErrors} />,
    },
    { title: "Contact details", body: <ContactSection values={values} errors={errors} set={set} /> },
    { title: "Social links", body: <SocialSection values={values} errors={errors} set={set} /> },
    { title: "Networking goals", body: <GoalsSection values={values} errors={errors} set={set} /> },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-6 pb-24">
        {formError && <Alert tone="danger">{formError}</Alert>}
        {sections.map((s) => (
          <Card key={s.title} className="p-5 sm:p-6">
            <h2 className="mb-5 text-base font-semibold">{s.title}</h2>
            {s.body}
          </Card>
        ))}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <p className="mb-3 text-sm font-medium text-ink-2">Live preview</p>
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-3xl bg-surface-2 p-3">
            <ProfileView profile={toPreview(values)} preview />
          </div>
        </div>
      </aside>

      {showPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-2 px-3 py-6 lg:hidden" role="dialog" aria-modal="true" aria-label="Preview">
          <div className="mx-auto mb-4 flex max-w-md justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowPreview(false)}>Close preview</Button>
          </div>
          <ProfileView profile={toPreview(values)} preview />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm text-ink-3" aria-live="polite">{dirty ? "Unsaved changes" : "All changes saved"}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="lg:hidden" onClick={() => setShowPreview(true)} icon={<Eye className="size-4" />}>
              Preview
            </Button>
            <Button onClick={save} loading={pending} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
