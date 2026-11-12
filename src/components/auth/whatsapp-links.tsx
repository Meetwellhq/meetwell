import { SocialIcon } from "@/components/icons/social-icon";
import { buttonClass } from "@/components/ui/button";
import { WHATSAPP_COMMUNITY_URL, WHATSAPP_FEEDBACK_URL } from "@/lib/config";

/** Shown once someone has joined: the same WhatsApp groups as the welcome email. */
export function WhatsAppLinks() {
  if (!WHATSAPP_COMMUNITY_URL && !WHATSAPP_FEEDBACK_URL) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-ink-2">
        While you wait, meet other early members and help shape Meetwell on WhatsApp.
      </p>
      {WHATSAPP_COMMUNITY_URL && (
        <a
          href={WHATSAPP_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ size: "lg", className: "w-full" })}
        >
          <SocialIcon platform="whatsapp" />
          Join the WhatsApp community
        </a>
      )}
      {WHATSAPP_FEEDBACK_URL && (
        <a
          href={WHATSAPP_FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: "secondary", size: "lg", className: "w-full" })}
        >
          Join the feedback group
        </a>
      )}
    </div>
  );
}
