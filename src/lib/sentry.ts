/**
 * Shared Sentry settings. Error reports only: no performance tracing, no session
 * replay, and no personal data (IP addresses, cookies, request bodies). Sentry
 * stays off until NEXT_PUBLIC_SENTRY_DSN is set (Vercel, production).
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0,
} as const;
