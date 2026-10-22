/**
 * Shared Sentry settings (Sentry's recommended Next.js defaults, minus session
 * replay and the feedback widget). Errors, plus timings for 10% of requests.
 * No personal data: no IP addresses, cookies or request bodies. Each report is
 * tagged with the deploy it came from (the Git commit Vercel built). Sentry stays
 * off until NEXT_PUBLIC_SENTRY_DSN is set (Vercel, production).
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
} as const;
