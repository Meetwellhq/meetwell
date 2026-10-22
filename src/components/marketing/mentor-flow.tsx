"use client";

import { CalendarDays, Check, CreditCard, Globe, Landmark, Lock, Mail, MessageCircle, Phone, Smartphone, UserRoundPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { SocialIcon } from "@/components/icons/social-icon";
import { CompanyAvatar } from "@/components/profile/company-avatar";
import { cn } from "@/lib/cn";
import { nairaShort } from "@/lib/format";

const STEPS = ["Message", "Pay", "Talk"] as const;

/**
 * Illustration of paying to message a mentor, as a short loop: the mentor's
 * card with its price button, a Paystack checkout, then the open conversation
 * and the mentor's share. Example people only. Stays on one step for people
 * who prefer reduced motion (the step buttons still work).
 */
export function MentorFlow() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <div className="relative h-[34rem] w-full" aria-live="polite">
        <Frame show={step === 0}>
          <CardStep />
        </Frame>
        <Frame show={step === 1}>
          <CheckoutStep />
        </Frame>
        <Frame show={step === 2}>
          <ChatStep />
        </Frame>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-surface/70 p-1" role="tablist" aria-label="Steps">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={step === i}
            onClick={() => setStep(i)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
              step === i ? "bg-accent text-white" : "text-ink-2 hover:text-ink",
            )}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Frame({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!show}
      className={cn(
        "absolute inset-0 flex items-center transition-all duration-500",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <div className="w-full">{children}</div>
    </div>
  );
}

/** The mentor's public card: Save contact, then the paid message button underneath. */
function CardStep() {
  const icons = [
    <Mail key="m" className="size-[18px]" aria-hidden />,
    <SocialIcon key="w" platform="whatsapp" className="size-[18px]" />,
    <Phone key="p" className="size-[18px]" aria-hidden />,
    <Globe key="g" className="size-[18px]" aria-hidden />,
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-2xl border border-border bg-surface px-5 pb-5 pt-6 text-center">
        <CompanyAvatar name="Chidi Nwosu" src="/demo/chidi.svg" organization="Brightwave" className="size-20 text-xl" badgeClassName="size-8" />
        <p className="mt-3 text-xl font-semibold tracking-tight text-ink">Chidi Nwosu</p>
        <p className="mt-0.5 text-sm text-ink-2">Engineering Manager · Brightwave</p>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-3">
          <CalendarDays className="size-3" aria-hidden />
          Joined 2026
        </p>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-ink-2">
          9 years building payment teams. I help engineers grow into leads.
        </p>
        <p className="mt-3">
          <span className="inline-block rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">Open to mentoring</span>
        </p>
        <div className="mt-4 flex h-11 items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-medium text-white">
          <UserRoundPlus className="size-[18px]" aria-hidden />
          Save contact
        </div>
        <div className="mt-2.5 flex h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface text-[15px] font-medium text-ink">
          <MessageCircle className="size-[18px]" aria-hidden />
          Message Chidi · {nairaShort(500_000)}/month
        </div>
        <div className="mt-3 flex justify-center gap-2.5">
          {icons.map((icon, i) => (
            <span key={i} className="grid size-10 place-items-center rounded-full border border-border text-ink">
              {icon}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        {(["linkedin", "x"] as const).map((p) => (
          <span key={p} className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-ink-2">
            <SocialIcon platform={p} className="size-4 text-ink" />
            {p === "linkedin" ? "in/chidinwosu" : "@chidibuilds"}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A simple Paystack-style checkout (illustration, not Paystack's real screen). */
function CheckoutStep() {
  const methods = [
    { icon: CreditCard, label: "Card", on: true },
    { icon: Landmark, label: "Bank transfer", on: false },
    { icon: Smartphone, label: "USSD", on: false },
  ];
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <p className="text-xs text-ink-3">Meet Well Limited</p>
          <p className="text-sm font-medium text-ink">Messages with Chidi · 30 days</p>
        </div>
        <p className="text-lg font-semibold tabular-nums text-ink">₦5,000</p>
      </div>
      <div className="flex flex-col gap-2 p-5">
        {methods.map((m) => (
          <div
            key={m.label}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm",
              m.on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-ink-2",
            )}
          >
            <m.icon className="size-4" aria-hidden />
            {m.label}
          </div>
        ))}
        <div className="mt-2 flex h-11 items-center justify-center rounded-lg bg-[#3bb75e] text-[15px] font-semibold text-white">
          Pay ₦5,000
        </div>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-ink-3">
          <Lock className="size-3" aria-hidden />
          Secured by Paystack
        </p>
      </div>
    </div>
  );
}

/** After paying: the conversation is open, and the mentor sees their share. */
function ChatStep() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[1.25rem] border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          <span className="grid size-5 place-items-center rounded-full bg-success text-white">
            <Check className="size-3" aria-hidden />
          </span>
          Payment received · 30 days of messages
        </div>
        <div className="mt-4 flex flex-col gap-2 text-[14px] leading-snug">
          <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-white">
            Hi Chidi! I&apos;m moving from frontend to engineering management. How did you make the jump?
          </p>
          <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-ink">
            Great question. Start by leading one small project end to end. Happy to walk you through it.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-[1.25rem] border border-border bg-surface px-4 py-3.5">
        <div>
          <p className="text-xs text-ink-3">Chidi&apos;s earnings</p>
          <p className="text-sm text-ink-2">You keep 80%. Withdraw to your bank.</p>
        </div>
        <p className="shrink-0 whitespace-nowrap pl-3 text-xl font-semibold tabular-nums text-success">+₦4,000</p>
      </div>
    </div>
  );
}
