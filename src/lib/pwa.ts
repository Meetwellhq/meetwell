// Install-as-app helpers (PWA). Chrome and Edge on Android and computers fire
// `beforeinstallprompt`, which lets our own "Install" button open the install
// dialog. iPhone and iPad have no such event: people add it from Safari's Share
// menu, so we show them the steps instead.

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __meetwellInstall?: InstallPromptEvent | null;
  }
}

/** Fired on window when the install prompt becomes available or is used up. */
export const INSTALL_EVENT = "meetwell:install-change";

/** Already opened as an installed app (home screen icon), so there's nothing to offer. */
export function isInstalled() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone or iPad (iPadOS reports itself as a Mac with a touch screen). */
export function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function isAndroid() {
  return typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
}

/** Safari on iOS is the only iOS browser that reliably offers "Add to Home Screen". */
export function isIosSafari() {
  return isIos() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
}
