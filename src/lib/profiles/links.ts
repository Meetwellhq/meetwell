import type { PublicProfile } from "./types";

export type ContactAction = {
  key: string;
  kind: "email" | "phone" | "sms" | "whatsapp" | "website";
  label: string;
  /** Text describing the destination, e.g. the email address. */
  detail: string;
  href: string;
  event: "email_click" | "phone_click" | "website_click";
};

export function displayUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

/** Build tap-to-act links for the public contact methods. */
export function contactActions(profile: Pick<PublicProfile, "contacts" | "websiteUrl">): ContactAction[] {
  const actions: ContactAction[] = [];
  profile.contacts.forEach((c, i) => {
    const suffix = c.label ? ` (${c.label})` : "";
    if (c.type === "email") {
      actions.push({
        key: `email-${i}`,
        kind: "email",
        label: `Email${suffix}`,
        detail: c.value,
        href: `mailto:${encodeURIComponent(c.value).replace("%40", "@")}`,
        event: "email_click",
      });
    } else if (c.type === "phone") {
      actions.push(
        { key: `call-${i}`, kind: "phone", label: `Call${suffix}`, detail: c.value, href: `tel:${c.value}`, event: "phone_click" },
        { key: `sms-${i}`, kind: "sms", label: `Text${suffix}`, detail: c.value, href: `sms:${c.value}`, event: "phone_click" },
      );
    } else if (c.type === "whatsapp") {
      actions.push({
        key: `wa-${i}`,
        kind: "whatsapp",
        label: `WhatsApp${suffix}`,
        detail: c.value,
        href: `https://wa.me/${c.value.replace(/\D/g, "")}`,
        event: "phone_click",
      });
    }
  });
  if (profile.websiteUrl) {
    actions.push({
      key: "website",
      kind: "website",
      label: "Website",
      detail: displayUrl(profile.websiteUrl),
      href: profile.websiteUrl,
      event: "website_click",
    });
  }
  return actions;
}

export function mailtoWithBody(email: string, subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  // mailto expects %20 rather than + for spaces.
  return `mailto:${email}?${params.toString().replace(/\+/g, "%20")}`;
}
