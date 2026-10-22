/**
 * Cards a visitor opened before having an account, kept on their own phone
 * (browser storage, never sent to us until they sign up). Storage can be
 * unavailable (private mode) or cleared, so every read and write is guarded.
 */
const KEY = "meetwell:saved-cards";
const MAX = 50;

export type DeviceCard = { slug: string; name: string; source: "qr" | "link"; at: string };

export function readDeviceCards(): DeviceCard[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c?.slug === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Remembers a card (newest first, once each). Returns the updated list. */
export function rememberDeviceCard(card: Omit<DeviceCard, "at">): DeviceCard[] {
  const list = [{ ...card, at: new Date().toISOString() }, ...readDeviceCards().filter((c) => c.slug !== card.slug)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: nothing to keep.
  }
  return list;
}

export function clearDeviceCards() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
