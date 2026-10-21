# Meetwell project guide

Context for anyone (human or AI) picking up this project. Last updated 21 October 2026.
Read this before changing anything. For the story of how it was built, the founder's
preferences and past decisions, read [PROJECT_HISTORY.md](PROJECT_HISTORY.md) too.

## Ground rules from the founder (Rasheed)

- **Never deploy without an explicit "yes, deploy" from Rasheed, every time.** Pushing to
  `main` deploys to production automatically, so never `git push` to `main`, run
  `vercel deploy`, or trigger a Vercel deployment without that go-ahead. Commit locally,
  then ask.
- Explain things in plain language. Rasheed is the founder, not a developer.
- Database changes are applied by Rasheed by hand in the Supabase SQL Editor. When a change
  needs SQL, give the exact SQL to paste (no placeholders that look like values), and check
  from outside afterwards that it took effect.
- Keep copy short and human. Avoid long dashes and stacked phrases that read as AI-written.
- Show, don't just tell: for visual changes, render it (browser or a preview file) and show
  Rasheed before committing; for emails, render an HTML preview.
- Never put secrets or personal data in the repo. It is **public** (view-only licence).

## What Meetwell is

A networking card with its own QR code. Someone scans it with their phone camera (no app),
saves the contact in one tap (vCard), and gets a ready-made, editable first message.
Live at **https://meetwell.me**. Built in Lagos, Nigeria.

Status: **private beta**. Public sign-up is closed. People join a waiting list; Rasheed
invites them from an admin page; they sign up with a personal access code.

## Stack and services

| Piece | What it is | Notes |
| --- | --- | --- |
| Code | Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript, Tailwind 4 | GitHub: `Meetwellhq/meetwell` (public repo, "all rights reserved" licence) |
| Hosting | Vercel, project `meetwell`, team "Meetwell" (Hobby plan) | Auto-deploys on push to `main`. Domain `meetwell.me` (DNS on Vercel) |
| Database, auth, storage | Supabase | RLS everywhere; public reads only through security-definer RPCs |
| App emails | Resend (`noreply@meetwell.me`) | Via Supabase SMTP (auth emails) and the Resend API (founder emails) |
| Mailbox | Zoho Mail: `info@meetwell.me`, aliases `hello@meetwell.me` and `support@meetwell.me` (support@ is the address shown on the site and in every email) | MX, SPF (`include:zohomail.com`) and DKIM (`zmail._domainkey`) on Vercel DNS |
| Scheduled jobs | Vercel Cron (daily) + Supabase `pg_cron` (nightly) | See below |

This version of Next.js has breaking changes: read `node_modules/next/dist/docs/` before
writing Next.js code (see `AGENTS.md`).

## Commands

- `npm run dev` (local dev; often run as `npm run dev -- --port 3100`)
- `npx tsc --noEmit`, `npm run lint`, `npm test` (Vitest: unit tests + PGlite database tests)
- `npm run build` (production build)

Database tests (`tests/db/rls.test.ts`) run every migration in `supabase/migrations` against an
in-process Postgres (`tests/db/supabase-stubs.sql` fakes the Supabase bits). Add a test with
every migration.

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + `.env.local` | Supabase connection (public keys only; the app never uses the service role key) |
| `NEXT_PUBLIC_SITE_URL` | Vercel (production) = `https://meetwell.me` | Absolute links, QR codes, email links |
| `RESEND_API_KEY` | Vercel (production, sensitive) | Founder emails. Without it, emails are skipped (fine locally) |
| `CRON_SECRET` | Vercel (production, sensitive) | Protects the daily reminders and matching jobs. Must equal `internal_settings.cron_secret` in Supabase |
| `ANTHROPIC_API_KEY` | Vercel (production, sensitive) | Claude for AI Network Matching. Without it, matching falls back to rule-based picks and template reasons |

## Key features and where they live

- **Landing page**: `src/app/page.tsx`, `src/components/marketing/*`. Hero photo
  `public/hero/hero-photo.webp`. Link preview image `src/app/opengraph-image.png` (a
  screenshot of the hero; retake it if the hero changes).
- **Private beta switch**: `SIGNUPS_OPEN` in `src/lib/config.ts` (false). The database also
  enforces invite-only sign-up (see access codes).
- **Waiting list**: `/early-access`, `joinWaitlist` in `src/lib/auth/actions.ts`. Duplicate
  emails show an error. New joiners get a founder welcome email.
- **Waiting-list updates**: people are told on sign-up they'll get occasional updates. Each
  waitlist row has a private `unsubscribe_token`; `/unsubscribe?t=…` sets `unsubscribed_at`
  (invites still go out). Any update email must include that link and skip unsubscribed people.
- **Access codes**: `/access-code` (prefilled from `?code=`). A trigger on `auth.users`
  refuses new accounts without a valid code and uses it up. Codes live in
  `public.access_codes`. To reopen public sign-up later: make `public.invite_only()` return
  false and set `SIGNUPS_OPEN = true`.
- **Log in page**: `/sign-in` shows the private beta chooser; `?method=email` shows the form.
- **Cards**: public card `/p/[slug]` (`src/components/profile/profile-view.tsx`) with a
  floating green "Try it for free" bar. Editor in `/dashboard/profile`.
- **Title and company pickers**: `src/lib/profiles/careers.ts` holds the suggested titles (tech
  careers) and companies; both stay free text ("Other"). `findCompany()` matches a card's
  organisation to a company, and `CompanyAvatar` shows its logo (`public/companies/*.png`, 96px,
  from each company's own site icon) or a building icon on the photo. Paystack, Access Bank and
  Dangote have no logo file yet (Paystack blocks downloads, Dangote's site was down, Access only
  has a 16px icon); add a 96px PNG and set `logo` to use one.
- **QR codes**: `src/lib/qr.ts`. Error correction H with the Meetwell logo in the middle; PNG
  rendered with `sharp`. The QR encodes the profile URL only.
- **Admin (Invites tab)**: `/dashboard/invites`, visible only to admins (`public.admins`).
  Waiting list with Invite/Resend, Members with card status, photo, views, QR scans, saves and
  reminder tags. Database functions refuse non-admins.
- **Spark has two sides**, decided by years of experience (`MENTOR_MIN_YEARS` = 4 in
  `src/lib/matching/constants.ts`, same line in SQL): under 4 get introductions; 4+ are only
  recommended (`20261103000000_spark_roles.sql`). Years and field are asked in onboarding (step
  "Your experience", `saveExperience` in `src/lib/matching/actions.ts`) or on the Spark page if
  missing. 4+ members see a checklist and how often they were introduced (`my_spark_mentor_stats`).
  A manual review of 4+ members is planned before paid features; not built yet.
- **Spark (AI Network Matching)**: `/dashboard/matches` (shown to members as "Spark"; the URL stays /matches so old email links work) (opt-in + private fields: field, experience,
  looking for, city; list of matches). Recommends only people with 4+ years, a profile
  photo and more experience than the member, in the same or a related field
  (`20261031000000_matching_min_experience.sql`). Up to 5 free matches per member per calendar month (Lagos time), at most one a day (`20261101000000_spark_monthly_limit.sql`; keep `SPARK_FREE_PER_MONTH` in `src/lib/matching/constants.ts` in step). Daily job
  `src/app/api/cron/matches/route.ts` (09:00 UTC): `matching_due_users()` → `matching_candidates()`
  (scores: field, extra years, mentoring, city; small penalty per recent recommendation; no
  repeats; photo required) → `chooseMatch()` in `src/lib/matching/engine.ts` (Claude `claude-opus-5-5`, low effort,
  structured output; falls back to rules) → `record_match()` → match email. One-way: only the less
  experienced member is told. Up to ~60 members per run on the current Vercel plan.
  Only members with a confirmed account and a profile at least 80% complete are matched or
  recommended (`profile_completeness()` in SQL, `src/lib/matching/completeness.ts` for the page;
  keep them in step). Members under 80% get a one-time `profile_incomplete` reminder; without a
  photo, 4+ years get "people want to learn from you" copy, others "a photo gets you matches".
- **Founder emails**: `src/lib/founder-emails.ts` (pure templates, unit-tested) and
  `src/lib/email.ts` (sending). From "Rasheed from Meetwell" `<noreply@meetwell.me>`, reply-to
  `support@meetwell.me`, with Rasheed's photo (`public/founder/rasheed.jpg`).
- **Announcements**: one-off emails from the founder to every confirmed member, sent from the
  Invites tab ("Send Spark email", in paced batches; click again for the rest). Each person gets each
  announcement once (`public.announcements_sent`, `20261102000000_announcements.sql`). Template:
  `sparkBetaEmail` in `src/lib/founder-emails.ts`.
- **Changelog**: written at every deploy (see Deploying). `/changelog` is built from `CHANGELOG.md` (`src/lib/changelog.ts` reads the small
  Markdown subset used there). Linked in the footer. Add a dated `## D Month YYYY: Title` entry per release.
- **Automatic reminders**: `src/app/api/cron/reminders/route.ts`, scheduled in `vercel.json`
  (08:00 UTC daily). `public.claim_reminders()` picks who is due and records each send in
  `public.reminders_sent`, so every reminder goes out at most once per person:
  unused invite (3 days), unconfirmed email (1 to 14 days, Supabase re-sends), draft card
  (2 days), published but no QR scans (7 days), profile under 80% (1 day after publishing).
- **Nightly clean-up**: `pg_cron` job `purge-profile-events` (03:00 UTC) deletes engagement
  events older than 13 months, as the Privacy notice promises.
- **Legal**: `/terms` and `/privacy`, written for Nigerian law (Constitution s.37, NDPA 2023,
  FCCPA 2018). Not yet reviewed by a lawyer. Run by **Meet Well Limited (RC 9952279)**, incorporated
  21 October 2026 (`COMPANY_NAME`, `COMPANY_RC` in `src/lib/config.ts`; shown in the footer, Terms, Privacy).

## Deploying

1. Get Rasheed's explicit OK.
2. **Changelog, with Rasheed's OK first**: look at what changed since the live version
   (`git log origin/main..HEAD`). Never add an entry on your own: draft it in chat
   (`## D Month YYYY: Title`, a few plain bullets, only what members see) and wait for his OK.
   He decides which changes go in; not every change gets an entry. `npm run check:changelog` fails
   if screens, emails or public files changed without a changelog update; when Rasheed says no
   entry is needed, run it as `CHANGELOG_SKIP=1 npm run check:changelog`. The `/changelog` page
   rebuilds from the file on deploy.
3. Run `npm run check:changelog`, `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
4. `git push origin main`. 5. Confirm a new Vercel deployment for that commit becomes READY
(Vercel MCP `list_deployments`) and check the live site.

If no deployment appears within a few minutes (GitHub → Vercel occasionally misses a push),
trigger it from the same commit with Vercel MCP `create_deployment`
(`gitSource: {type: "github", org: "Meetwellhq", repo: "meetwell", ref: "main", sha: <full sha>}`,
`target: "production"`). Only do this for a deploy Rasheed already approved.

Vercel limits on the Hobby plan: one person per team; private org repos can't deploy (hence
the public repo); cron jobs run once a day; functions max ~60s; runtime logs kept 1 hour.
Vercel's MCP can add DNS records but not edit or delete them (Rasheed does those in the
dashboard).

## Accounts

All services are under company accounts owned by Rasheed, mostly via `admin@meetwell.me`:
GitHub org `Meetwellhq`, Vercel team "Meetwell", Supabase org, Resend, Zoho (super admin).
Rasheed's personal secrets (reminders job secret, keys) live in his password manager, not here.

## Database migrations

All files in `supabase/migrations/` have been run in production, in order, as of the date
above (the `add_networking_goal` one is harmless if unsure). For any new migration: write the
file, add a database test, then give Rasheed the SQL to run, and confirm from outside.

Supabase grants EXECUTE on new functions to `anon` by default, and `revoke ... from public`
does not remove that. Revoke from `anon` explicitly for anything visitors must not call.

## Open items

- Talk to the first invited users; invite the next batch from the Invites tab.
- Lawyer review of Terms and Privacy.
- Optional: delete meetwell.me from ImprovMX (no longer used).
- Ideas waiting on user feedback: printable QR card, simpler onboarding, stats on each
  user's own dashboard, paid plans (e.g. Paystack).
- Optional: add `ANTHROPIC_API_KEY` in Vercel for Claude-written match reasons.
- CAC done (Meet Well Limited): LICENSE and README now name the company as copyright holder. Still to do:
  a written transfer of the code and brand from Rasheed to the company (lawyer), and
  upgrade Paystack to a Registered Business when payments start.
