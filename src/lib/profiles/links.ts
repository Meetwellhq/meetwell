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

/**
 * Android Chrome downloads .vcf files instead of opening them. This intent
 * opens the Contacts app's "new contact" screen pre-filled instead, falling
 * back to the vCard URL if no app handles it.
 * Extras follow ContactsContract.Intents.Insert.
 */
export function androidSaveContactIntent(
  profile: Pick<PublicProfile, "fullName" | "title" | "organization" | "contacts">,
  fallbackUrl: string,
) {
  const email = profile.contacts.find((c) => c.type === "email")?.value;
  const phone = profile.contacts.find((c) => c.type === "phone")?.value;
  const whatsapp = profile.contacts.find((c) => c.type === "whatsapp")?.value;
  const extras: [string, string | null | undefined][] = [
    ["name", profile.fullName],
    ["email", email],
    ["phone", phone ?? whatsapp],
    ["secondary_phone", phone && whatsapp && whatsapp !== phone ? whatsapp : null],
    ["company", profile.organization],
    ["job_title", profile.title],
    ["browser_fallback_url", fallbackUrl],
  ];
  const parts = extras
    .filter(([, v]) => v)
    .map(([k, v]) => `S.${k}=${encodeURIComponent(v as string)}`);
  return `intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/raw_contact;${parts.join(";")};end`;
}

export function mailtoWithBody(email: string, subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  // mailto expects %20 rather than + for spaces.
  return `mailto:${email}?${params.toString().replace(/\+/g, "%20")}`;
}
