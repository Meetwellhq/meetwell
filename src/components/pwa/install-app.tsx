"use client";

import { Check, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { INSTALL_EVENT, isAndroid, isInstalled, isIos, isIosSafari } from "@/lib/pwa";

const DISMISSED_KEY = "meetwell-install-dismissed";

type Device = "server" | "installed" | "ios-safari" | "ios-other" | "android" | "other";

const noSubscribe = () => () => {};
const subscribePrompt = (onChange: () => void) => {
  window.addEventListener(INSTALL_EVENT, onChange);
  return () => window.removeEventListener(INSTALL_EVENT, onChange);
};
const readDevice = (): Device =>
  isInstalled()
    ? "installed"
    : isIosSafari()
      ? "ios-safari"
      : isIos()
        ? "ios-other"
        : isAndroid()
          ? "android"
          : "other";
const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * "Install the app" (PWA). `banner` sits at the top of the dashboard, only when
 * installing is possible on this device, and can be closed for good. `row` is
 * the always-there version in Settings.
 */
export function InstallApp({ variant }: { variant: "banner" | "row" }) {
  const prompt = useSyncExternalStore(subscribePrompt, () => window.__meetwellInstall ?? null, () => null);
  const device = useSyncExternalStore(noSubscribe, readDevice, (): Device => "server");
  const dismissedBefore = useSyncExternalStore(noSubscribe, readDismissed, () => true);
  const [closed, setClosed] = useState(false);
  const [installing, setInstalling] = useState(false);

  async function install() {
    if (!prompt) return;
    setInstalling(true);
    await prompt.prompt();
    await prompt.userChoice;
    window.__meetwellInstall = null; // A prompt can only be used once.
    window.dispatchEvent(new Event(INSTALL_EVENT));
    setInstalling(false);
  }

  function close() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setClosed(true);
  }

  if (device === "server") return null;

  const iosSteps = (
    <ol className="mt-3 flex flex-col gap-2 text-sm text-ink">
      <li className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">1</span>
        Tap <Share className="size-4 text-accent" aria-label="Share" /> Share at the bottom of Safari
      </li>
      <li className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">2</span>
        Choose <SquarePlus className="size-4 text-accent" aria-hidden /> Add to Home Screen
      </li>
    </ol>
  );

  if (variant === "banner") {
    const canInstall = device !== "installed" && (prompt || device === "ios-safari");
    if (!canInstall || dismissedBefore || closed) return null;
    return (
      <section className="relative flex flex-col gap-3 rounded-2xl bg-surface p-4 pr-12 sm:flex-row sm:items-center sm:gap-4 sm:p-5 sm:pr-14">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-white">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">Get the Meetwell app</p>
          <p className="text-sm text-ink-2">
            Add Meetwell to your home screen. It opens like an app, with your card one tap away. No app store needed.
          </p>
          {!prompt && iosSteps}
        </div>
        {prompt && (
          <Button size="sm" onClick={install} loading={installing} className="self-start sm:self-center">
            Install
          </Button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold">Meetwell app</h2>
          <p className="mt-1 text-sm text-ink-2">
            {device === "installed"
              ? "You're using the app."
              : prompt
                ? "Add Meetwell to your home screen. It opens like an app."
                : device === "ios-safari"
                  ? "Add Meetwell to your home screen from Safari:"
                  : device === "ios-other"
                    ? "Open meetwell.me in Safari to add it to your home screen."
                    : device === "android"
                      ? "Open your browser menu (⋮) and choose Install app or Add to Home screen."
                      : "On your phone, open meetwell.me in Chrome or Safari to add it to your home screen."}
          </p>
        </div>
        {device === "installed" ? (
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
            <Check className="size-4" aria-hidden /> Installed
          </span>
        ) : (
          prompt && (
            <Button size="sm" variant="secondary" onClick={install} loading={installing}>
              Install
            </Button>
          )
        )}
      </div>
      {device === "ios-safari" && !prompt && iosSteps}
    </div>
  );
}
