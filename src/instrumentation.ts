import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

/** Starts Sentry on the server (Node and edge runtimes). */
export function register() {
  Sentry.init(sentryOptions);
}

/** Reports errors from pages, server actions and API routes to Sentry. */
export const onRequestError = Sentry.captureRequestError;
