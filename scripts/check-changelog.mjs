// Deploy reminder (never blocks): lists what members will see change since the
// live version (origin/main). The changelog is only for big new features, such
// as Spark, payments or the QR code, never small tweaks, and an entry is only
// added after Rasheed approves the draft. Run: npm run check:changelog
import { execFileSync } from "node:child_process";

const base = process.argv[2] ?? "origin/main";
const head = process.argv[3] ?? "HEAD";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

git("fetch", "--quiet", "origin", "main");
const changed = git("diff", "--name-only", `${base}...${head}`).split("\n").filter(Boolean);
const memberFacing = changed.filter(
  (f) =>
    (f.startsWith("src/app/") || f.startsWith("src/components/") || f.startsWith("public/") ||
      f === "src/lib/founder-emails.ts") &&
    !f.startsWith("src/app/api/") && !f.startsWith("src/app/admin/") && !f.startsWith("src/components/admin/"),
);

if (memberFacing.length === 0) {
  console.log("Changelog: nothing members can see changed.");
} else if (changed.includes("CHANGELOG.md")) {
  console.log("Changelog: updated in this deploy (make sure Rasheed approved the entry).");
} else {
  console.log(`Changelog: ${memberFacing.length} member-facing file(s) changed. Only if this ships a big new feature`);
  console.log("(like Spark, payments or the QR code), draft an entry and ask Rasheed. Small changes don't go in.");
}
