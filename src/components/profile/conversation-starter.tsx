"use client";

import { Check, Copy, Mail, RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/cn";
import { mailtoWithBody } from "@/lib/profiles/links";
import { templateGenerator } from "@/lib/starters/templates";
import { STARTER_INTENTS, type StarterGenerator, type StarterIntent, type StarterProfile } from "@/lib/starters/types";
import { track } from "./tracking";

type Props = {
  profile: StarterProfile;
  /** First public email, used for the optional "Open in email app" shortcut. */
  email: string | null;
  /** null in preview mode: disables analytics. */
  slug: string | null;
  generator?: StarterGenerator;
};

export function ConversationStarter({ profile, email, slug, generator = templateGenerator }: Props) {
  const toast = useToast();
  const groupId = useId();
  const [intent, setIntent] = useState<StarterIntent | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const firstName = profile.fullName.split(/\s+/)[0];

  async function choose(next: StarterIntent) {
    setIntent(next);
    setCopied(false);
    const drafts = await generator.generate({ intent: next, profile });
    setOptions(drafts);
    setIndex(0);
    setMessage(drafts[0] ?? "");
  }

  function another() {
    if (options.length < 2) return;
    const nextIndex = (index + 1) % options.length;
    setIndex(nextIndex);
    setMessage(options[nextIndex]);
    setCopied(false);
  }

  async function copy() {
    const ok = await copyText(message);
    if (ok) {
      setCopied(true);
      track(slug, "copy_message");
      toast("Message copied. Paste it into your email or messaging app.");
    } else {
      setCopied(false);
      toast("Couldn't copy automatically. Select the text and copy it manually.", "error");
    }
  }

  return (
    <section aria-labelledby={`${groupId}-title`} className="rounded-2xl border border-border bg-surface p-5">
      <h2 id={`${groupId}-title`} className="text-base font-semibold text-ink">
        Start a conversation
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Pick what you&apos;d like to talk about and we&apos;ll draft a short message you can edit.
      </p>

      <div role="radiogroup" aria-label="What would you like to do?" className="mt-4 flex flex-wrap gap-2">
        {STARTER_INTENTS.map((option) => {
          const active = intent === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(option.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-border-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {intent && (
        <div className="mt-5">
          <label htmlFor={`${groupId}-message`} className="text-sm font-medium text-ink">
            Your message to {firstName}
          </label>
          <textarea
            id={`${groupId}-message`}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setCopied(false);
            }}
            rows={5}
            maxLength={1000}
            className="mt-1.5 w-full rounded-xl border border-border-strong bg-bg px-3.5 py-3 text-[15px] leading-relaxed text-ink focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
          <p className="mt-1 text-xs text-ink-3">
            This is a draft — nothing is sent from here. Edit it however you like.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={copy} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} disabled={!message.trim()}>
              {copied ? "Copied" : "Copy message"}
            </Button>
            {email && (
              <a
                href={mailtoWithBody(email, "Nice to connect", message)}
                onClick={() => track(slug, "email_click")}
                className={buttonClass({ variant: "secondary" })}
              >
                <Mail className="size-4" aria-hidden />
                Open in email app
              </a>
            )}
            {options.length > 1 && (
              <Button variant="ghost" onClick={another} icon={<RefreshCw className="size-4" />}>
                Try another
              </Button>
            )}
          </div>
          <p aria-live="polite" className="sr-only">
            {copied ? "Message copied to clipboard" : ""}
          </p>
        </div>
      )}
    </section>
  );
}
