// Deploy check: if anything members can see changed since the live version
// (origin/main), CHANGELOG.md must have changed too. Run: npm run check:changelog
// Entries are only added with Rasheed's OK. When he says a change needs no entry,
// run with CHANGELOG_SKIP=1.
import { execFileSync } from "node:child_process";

const base = process.argv[2] ?? "origin/main";
const head = process.argv[3] ?? "HEAD";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

git("fetch", "--quiet", "origin", "main");
const changed = git("diff", "--name-only", `${base}...${head}`).split("\n").filter(Boolean);

// Screens, emails and public files. Tests, docs, SQL and tooling don't need an entry.
const memberFacing = changed.filter(
  (f) =>
    (f.startsWith("src/app/") || f.startsWith("src/components/") || f.startsWith("public/") ||
      f === "src/lib/founder-emails.ts") &&
    !f.startsWith("src/app/api/"),
);

if (process.env.CHANGELOG_SKIP === "1") {
  console.log("Changelog check skipped: Rasheed said no entry is needed for this deploy.");
} else if (memberFacing.length === 0) {
  console.log("Changelog check: nothing members can see changed. OK.");
} else if (changed.includes("CHANGELOG.md")) {
  console.log(`Changelog check: ${memberFacing.length} member-facing file(s) changed and CHANGELOG.md is updated. OK.`);
} else {
  console.error("Changelog check failed: these files change what members see, but CHANGELOG.md wasn't updated:");
  for (const f of memberFacing) console.error(`  ${f}`);
  console.error("Draft a short entry and get Rasheed's OK before adding it, or, if he says no entry is needed,");
  console.error("run with CHANGELOG_SKIP=1.");
  process.exit(1);
}
