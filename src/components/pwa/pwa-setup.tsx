"use client";

import { useEffect } from "react";
import { INSTALL_EVENT, type InstallPromptEvent } from "@/lib/pwa";

/**
 * Registers the service worker (public/sw.js: offline page only) and keeps the
 * browser's install prompt for the "Install the app" buttons, which may mount
 * later than the event fires. Renders nothing.
 */
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault(); // We show our own button instead of the browser's mini bar.
      window.__meetwellInstall = e as InstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_EVENT));
    };
    const onInstalled = () => {
      window.__meetwellInstall = null;
      window.dispatchEvent(new Event(INSTALL_EVENT));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
