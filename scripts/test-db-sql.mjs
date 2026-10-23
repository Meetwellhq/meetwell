// Builds one SQL file that sets up the test database (a separate Supabase
// project used for local testing, never for real members): every migration in
// order, then test-only settings (a fresh cron secret and a reusable access
// code). Paste the output into the test project's SQL Editor and run it once.
// Writes to docs/private/ (never pushed). Run: npm run test-db:sql
import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const secret = randomBytes(24).toString("hex");

const parts = [
  "-- Meetwell TEST database setup. Never run this on the live project.",
  `-- ${files.length} migrations, built ${new Date().toISOString().slice(0, 10)}.`,
  "begin;",
  ...files.map((f) => `\n-- ===== ${f} =====\n${readFileSync(join(dir, f), "utf8")}`),
  "\n-- ===== Test-only settings =====",
  `insert into public.internal_settings (key, value) values ('cron_secret', '${secret}')`,
  "  on conflict (key) do update set value = excluded.value;",
  "insert into public.access_codes (code, max_uses, note) values ('TESTMEETWELL', 1000, 'Test database')",
  "  on conflict (code) do nothing;",
  "commit;",
  "",
];

mkdirSync("docs/private", { recursive: true });
const out = "docs/private/test-db-setup.sql";
writeFileSync(out, parts.join("\n"));
writeFileSync("docs/private/test-db-cron-secret.txt", `${secret}\n`);
console.log(`Wrote ${out} (${files.length} migrations). Cron secret in docs/private/test-db-cron-secret.txt`);
