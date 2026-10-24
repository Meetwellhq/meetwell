import { date } from "@/components/admin/admin-ui";
import { TEMPLATES } from "@/lib/admin/campaigns";
import { cn } from "@/lib/cn";

export type EmailResult = {
  template: string;
  sent_on: string;
  people: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  acted: number;
};

/** Below this many people, one person changes the percentage a lot, so we don't call it good or low. */
const TOO_FEW = 20;

/**
 * Rough guides for short personal emails to people who signed up. Opens run
 * high because some email apps (Apple Mail) open every email by themselves.
 */
const TYPICAL = {
  delivered: { low: 95, label: "95% or more" },
  opened: { low: 30, high: 50, label: "30 to 50%" },
  clicked: { low: 5, high: 15, label: "5 to 15%" },
} as const;

const share = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

function verdict(step: keyof typeof TYPICAL, percent: number, people: number) {
  if (people < TOO_FEW) return { text: "Too few people to judge", tone: "neutral" as const };
  const t = TYPICAL[step];
  if (percent < t.low) return { text: "Lower than usual", tone: "warning" as const };
  if ("high" in t && percent > t.high) return { text: "Better than usual", tone: "good" as const };
  return { text: "About normal", tone: "good" as const };
}

/** What each number means, in a sentence, for the top of the results. */
export function HowToRead() {
  return (
    <details className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-2">
      <summary className="cursor-pointer font-medium text-ink">How to read these numbers</summary>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-ink">Reached the inbox</dt>
          <dd>The email arrived. Normal is {TYPICAL.delivered.label}. If it&apos;s lower, some addresses don&apos;t work.</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Opened</dt>
          <dd>
            They opened it. Only a rough guide: Apple Mail opens every email by itself, and some apps hide opens. Normal is
            about {TYPICAL.opened.label}.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Tapped the button</dt>
          <dd>They clicked the button in the email. The surest sign they were interested. Normal is about {TYPICAL.clicked.label}.</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Did it</dt>
          <dd>
            They have now done what the email asked, checked on their profile (for example, their card is published). This is
            the number that matters most.
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-ink-3">
        Every percentage is out of the people it was sent to. We only count totals, never what one person did. With fewer
        than {TOO_FEW} people, a single person moves the numbers a lot. Opens and clicks can take a few hours to come in.
      </p>
    </details>
  );
}

/** One send: a plain sentence, then each step from sent to "did it" as a bar. */
export function EmailResultCard({ result: r }: { result: EmailResult }) {
  const t = TEMPLATES.find((x) => x.id === r.template);
  const label = t?.label ?? r.template;
  const did = t?.didSentence ?? "done what it asked";
  const tracked = r.delivered + r.opened + r.clicked + r.bounced > 0;
  const people = `${r.people} ${r.people === 1 ? "person" : "people"}`;

  const steps = [
    { key: "delivered", name: "Reached the inbox", value: r.delivered, tracked: true },
    { key: "opened", name: "Opened", value: r.opened, tracked: true },
    { key: "clicked", name: "Tapped the button", value: r.clicked, tracked: true },
    { key: "acted", name: `Did it: ${t?.did ?? "done"}`, value: r.acted, tracked: false },
  ] as const;

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div>
        <p className="font-medium text-ink">{label}</p>
        <p className="text-sm text-ink-3">
          Sent {date(`${r.sent_on}T12:00:00Z`)} to {people}
        </p>
      </div>

      <p className="text-[15px] text-ink">
        {r.acted > 0 ? (
          <>
            <span className="font-semibold text-accent">
              {r.acted} of {r.people} ({share(r.acted, r.people)}%)
            </span>{" "}
            have {did} since.
          </>
        ) : (
          <>Nobody has {did} yet. It can take a few days, so check back.</>
        )}
      </p>

      <ul className="flex flex-col gap-3">
        {steps.map((s) => {
          const percent = share(s.value, r.people);
          const v = s.key !== "acted" ? verdict(s.key, percent, r.people) : null;
          const missing = s.tracked && !tracked;
          return (
            <li key={s.key} className="grid gap-1.5 sm:grid-cols-[11rem_minmax(0,1fr)_9rem] sm:items-center sm:gap-4">
              <span className={cn("text-sm", s.key === "acted" ? "font-medium text-ink" : "text-ink-2")}>{s.name}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span
                  className={cn("block h-full rounded-full", s.key === "acted" ? "bg-accent" : "bg-accent/45")}
                  style={{ width: `${missing ? 0 : percent}%` }}
                />
              </span>
              <span className="flex items-baseline justify-between gap-2 text-sm sm:justify-end">
                {missing ? (
                  <span className="text-ink-3">Not tracked</span>
                ) : (
                  <>
                    <span className="tabular-nums text-ink">
                      {s.value} · <span className="font-medium">{percent}%</span>
                    </span>
                    {v && (
                      <span className={cn("text-xs sm:hidden", v.tone === "warning" ? "text-warning" : "text-ink-3")}>{v.text}</span>
                    )}
                  </>
                )}
              </span>
              {v && !missing && (
                <span className={cn("hidden text-xs sm:col-start-2 sm:-mt-1 sm:block", v.tone === "warning" ? "text-warning" : "text-ink-3")}>
                  {v.text}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {r.bounced > 0 && (
        <p className="text-sm text-danger">
          {r.bounced} {r.bounced === 1 ? "email" : "emails"} bounced: the address doesn&apos;t work, so it never arrived.
        </p>
      )}
      {!tracked && (
        <p className="text-xs text-ink-3">
          No opens or clicks for this send yet. Either it went out before tracking was switched on, or Resend hasn&apos;t
          reported yet. &ldquo;Did it&rdquo; still works.
        </p>
      )}
    </li>
  );
}
