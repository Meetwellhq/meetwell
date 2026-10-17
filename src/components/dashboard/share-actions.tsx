"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";

export function CopyLinkButton({ url, variant = "secondary" }: { url: string; variant?: "primary" | "secondary" }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={variant}
      icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      onClick={async () => {
        if (await copyText(url)) {
          setCopied(true);
          toast("Link copied to clipboard.");
          setTimeout(() => setCopied(false), 2000);
        } else {
          toast("Couldn't copy. Select the link and copy it manually.", "error");
        }
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

/** Uses the native share sheet where available (mobile), otherwise copies. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      icon={<Share2 className="size-4" />}
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {
            // User dismissed the share sheet.
          }
          return;
        }
        if (await copyText(url)) toast("Sharing isn't available here, so we copied the link instead.", "info");
      }}
    >
      Share
    </Button>
  );
}

export function LinkField({ url }: { url: string }) {
  return (
    <input
      readOnly
      value={url}
      aria-label="Your public profile link"
      onFocus={(e) => e.currentTarget.select()}
      className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-surface-2 px-3.5 font-mono text-sm text-ink-2"
    />
  );
}
