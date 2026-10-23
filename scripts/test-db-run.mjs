// Runs a SQL file on the TEST database only (Supabase project meetwell-test),
// using TEST_DATABASE_URL from .env.local. Refuses anything that isn't the test
// project, so it can never touch live members. Live SQL is still pasted by
// Rasheed in the live project's SQL Editor. Run: npm run test-db:run -- file.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const TEST_REF = "ltjipqudffzccxmvameb";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run test-db:run -- path/to/file.sql");
  process.exit(1);
}

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^TEST_DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("TEST_DATABASE_URL is missing from .env.local");
  process.exit(1);
}
if (new URL(url).username !== `postgres.${TEST_REF}`) {
  console.error("TEST_DATABASE_URL is not the meetwell-test project. Refusing to run.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const result = await client.query(readFileSync(file, "utf8"));
  const last = Array.isArray(result) ? result.at(-1) : result;
  console.log(`Ran ${file} on the test database.`);
  if (last?.rows?.length) console.table(last.rows);
} finally {
  await client.end();
}
