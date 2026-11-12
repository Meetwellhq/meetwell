import "server-only";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getSupabaseEnv } from "./config";

/** Spark launches when Meetwell has this many users, with about as many mentors as mentees. */
export const SPARK_LAUNCH_USERS = 5000;

/**
 * Whether Spark is switched on (public.spark_enabled(), set from the admin
 * Overview). While it's off, Spark is hidden everywhere: menu, pages,
 * marketing, emails and the daily matching job. Read without cookies so
 * pages built ahead of time can use it; once per request.
 */
export const isSparkOn = cache(async (): Promise<boolean> => {
  const env = getSupabaseEnv();
  if (!env) return false;
  const { data, error } = await createPlainClient(env.url, env.key, { auth: { persistSession: false } }).rpc("spark_enabled");
  return !error && data === true;
});
