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
| Hosting | Vercel, project `meetwell`, team "Meetwell" (Hobby plan; team ID `team_dSWwctnyg2mSiCL34Qbew1Ey`, slug `riskat-bolajoko-foundation`, for the Vercel MCP) | Auto-deploys on push to `main`. Domain `meetwell.me` (DNS on Vercel) |
| Database, auth, storage | Supabase | RLS everywhere; public reads only through security-definer RPCs |
| App emails | Resend (`noreply@meetwell.me`) | Via Supabase SMTP (auth emails) and the Resend API (founder emails) |
| Mailbox | Zoho Mail: `info@meetwell.me`, aliases `hello@meetwell.me` and `support@meetwell.me` (support@ is the address shown on the site and in every email) | MX, SPF (`include:zohomail.com`) and DKIM (`zmail._domainkey`) on Vercel DNS |
| Scheduled jobs | Vercel Cron (daily) + Supabase `pg_cron` (nightly clean-up, reply reminders every 15 min) | See below |

This version of Next.js has breaking changes: read `node_modules/next/dist/docs/` before
writing Next.js code (see `AGENTS.md`).

## Commands

- `npm run dev` (local dev; often run as `npm run dev -- --port 3100`)
- `npx tsc --noEmit`, `npm run lint`, `npm test` (Vitest: unit tests + PGlite database tests)
- `npm run build` (production build)
- `npm run test:smoke` (Playwright, read-only checks of the live site; `BASE_URL=http://localhost:3100` for local)

**Automatic checks (GitHub Actions).** `.github/workflows/checks.yml` runs types, lint, all tests and a build on
every push and pull request. `.github/workflows/smoke.yml` runs the Playwright checks (`e2e/smoke.spec.ts`) against
meetwell.me after Checks finishes on main, daily at 07:00 UTC, and by hand (Vercel does not report deploys to GitHub here). They never
sign up, pay or save anything. A failure shows as a red cross on the commit and GitHub emails the repo owner.

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
| `PAYSTACK_SECRET_KEY` | Vercel (production, sensitive) + `.env.local` for testing | Spark credits. Test key (`sk_test_…`) first; live key only with Rasheed's OK. Without it the credit packs are hidden. The webhook and return page also need `CRON_SECRET` |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel (production) | Sentry error reports (`src/instrumentation.ts`, `src/instrumentation-client.ts`, settings in `src/lib/sentry.ts`: errors plus 10% tracing, release = Vercel commit, no IPs/cookies, no replay or feedback widget). Without it Sentry is off. Listed in the Privacy notice. Org `meet-well`, project `meetwell` |
| `SENTRY_AUTH_TOKEN` | Vercel (production, sensitive) | Lets the build upload source maps to Sentry (`withSentryConfig` in `next.config.ts`) so error reports show readable code. Optional |
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
- **Age check**: every sign-up form has a required "at least 18" tick box (`confirmAge` on `AuthForm`; `signUp` refuses
  without it).
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
- **Admin area**: `/admin` (`src/app/admin/`), with its own log-in page `/admin/sign-in` (`adminSignIn`
  refuses non-admin accounts), for the separate admin account admin@meetwell.me
  (`public.admins`; everyone else gets a 404). Separate pages: Overview, Waiting list (Invite/Resend),
  Users (`/admin/users`; card status, photo, views, QR scans, saves, reminder tags; the admin area
  says "users", member pages say "members"), Mentors, Messages, Announcements, Payments;
  shared bits in `src/components/admin/admin-ui.tsx`. Admin accounts have no card: they're sent from /dashboard and /onboarding to /admin, and are
  left out of Members, announcements and reminders (`20261105000000_admin_account.sql`).
  `/dashboard/invites` redirects to `/admin`. Database functions refuse non-admins. The Overview
  (`admin_metrics()`, `20261106000000_admin_metrics.sql`) shows revenue, MRR/ARR (run rate: last 30
  days of credit sales), growth and Spark numbers with two charts; revenue shows in US dollars via
  `src/lib/fx.ts` (daily rate from open.er-api.com, attribution shown; falls back to naira).
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
- **Spark credits (Paystack)**: members under 4 years buy packs on the Spark page (`SparkCredits`,
  `buyCredits` in `src/lib/payments/actions.ts`). Prices live in `public.credit_packs`
  (`20261104000000_spark_credits.sql`), never in the browser. `start_credit_purchase()` makes a pending
  payment with a `mw_…` reference; Paystack's page takes the money; credits are added only by
  `confirm_payment()` (CRON_SECRET-protected, checks amount and currency, adds once) after
  `confirmWithPaystack()` re-checks the payment by API. Two ways in: the return page
  `/api/paystack/callback` and the webhook `/api/paystack/webhook` (HMAC-SHA512 signature checked;
  set `https://meetwell.me/api/paystack/webhook` in Paystack → Settings → API Keys & Webhooks).
  `public.credit_ledger` has one row per credit added or used; `record_match()` uses a credit only
  after the free 5 in a month. Payments list in /admin. Refunds by hand in Paystack.
- **Messages**: private conversations between a member (under 4 years) and a mentor (4+), in
  `/dashboard/messages` (list) and `/dashboard/messages/[id]` (thread, refreshes every 8s). The Messages tab
  only shows for people with a conversation, with an unread count. All rules live in
  `20261107000000_messaging.sql` (`send_message` etc.): participants only, member writes first, 1–2,000
  characters, 30 an hour, read-only after `access_until`, blocks both ways, 3 open reports pause
  someone. Email alert only for the first message each person sends in a conversation, LinkedIn-style
  (sender photo, title, preview, Reply; `claim_message_email`, CRON_SECRET, `20261109000000_first_message_email.sql`),
  off in Settings or via `/unsubscribe/messages?t=`. Message emails come from "Name via Meetwell" <messages-noreply@meetwell.me> (`messageFromLine`).
  Reply reminder: a message unanswered for 4 hours emails the person it waits on, once (`claim_reply_reminders`,
  `20261111000000_reply_reminders.sql`), via `/api/cron/reply-reminders`, called every 15 minutes by the Supabase
  pg_cron job `reply-reminders` (pg_net `http_get` with the cron secret from `internal_settings`). Admins open
  free test conversations and handle reports in `/admin/messages`; they never see chats, only reported
  messages with up to 3 either side. Rules page: `/community-rules`. Phase 4 will set `access_until`
  from paid subscriptions.
- **Mentors and paid messages (phase 4)**: members with 4+ years apply on `/dashboard/mentor`
  ("Mentoring" tab; checks: 4+ years, photo, 80%+, published, confirmed); Rasheed
  approves in `/admin/mentors`. Approved mentors choose Free or a 30-day price (N2,000–N20,000; free = `price_kobo` 0,
  `20261117000000_free_mentoring.sql`: "Message X · Free" opens a 30-day conversation with `start_free_conversation`, no
  payment, renewable for free). Paid mentors' card shows
  "Message {name} · price" → `/subscribe/[slug]` → Paystack. `confirm_payment()` opens/extends the
  conversation by 30 days and puts 80% in the mentor's wallet (`wallet_ledger`), available after 7 days.
  Withdrawals: N5,000 minimum to a Paystack-checked bank account (`payout_accounts` keeps only bank, name,
  last 4 and Paystack's recipient code); Rasheed approves each in /admin/mentors and it's sent by Paystack
  Transfer (needs the Registered Business upgrade, and Transfers OTP turned off for API transfers); the
  webhook records transfer.success/failed. Failed or rejected withdrawals return to the wallet. Refunds:
  /admin/mentors flags "No reply in 7 days"; Refund calls Paystack's refund API, takes the mentor's share
  back and ends access. Renewal reminder 3 days before the end (daily reminders job). Admin revenue counts
  only Meetwell's share. All in `20261108000000_mentor_subscriptions.sql`.
- **Contacts and sign-up through a card**: `/dashboard/contacts` (`20261114000000_contacts.sql`). A logged-in
  member who opens a card keeps it (`save_contact`, from `CardKeeper` on `/p/[slug]`). Visitors keep cards on their
  phone (`src/lib/contacts/device.ts`, localStorage) and the card's bottom bar becomes "Keep X's card · Join free" →
  `/join?via=slug`. During the private beta a card counts as an invite: sign-up without a code works through a
  published member's card, up to 20 per card (`card_invite_profile`, `card_signups`, checked in the
  `enforce_access_code` trigger). Phone-saved cards ride along in sign-up data (`saved_cards`) and are imported by the
  trigger; anything left is imported on the next dashboard visit (`DeviceCardsImporter`). Owners see members (with a
  card) who saved them (`who_saved_me`). "Export all" downloads one .vcf (`/dashboard/contacts/export`).
- **Partners (step 1: links and tracking)**: `/admin/partners` lists every partner; `/admin/partners/[slug]` shows one (link, team, mentors they invited, everyone else; `admin_partner_people`, `20261120000000_admin_partner_people.sql`). Tables in `20261119000000_partners.sql`. An event platform
  (first: ThinkUX) gets `/join?partner=<slug>`, which works as an invite (up to `max_signups`, 200 by default) and
  records the account in `partner_signups` for good (checked in `enforce_access_code`). Rasheed gives the partner's
  team access by email (`admin_add_partner_member`; they need an account); they get a "Partner" tab
  (`/dashboard/partner`, `my_partners`, `partner_people`) showing who joined: public card details only once
  published, plus a Mentor badge. Step 2 (not built): the partner's 10% of mentor payments, taken from Meetwell's
  20% (mentors keep 80%); how long it lasts is still to decide.
- **Outreach tracker**: `/admin/outreach` (`20261113000000_outreach.sql`, `src/lib/outreach.ts`). Rasheed adds
  people he finds on X one at a time or by pasting a list (one per line: handle or link, optional name and note;
  `parseOutreachList`); names are optional ("Hi there") and editable. Each person gets a single-use access code (60 days), a "Copy message"
  with their name and invite link, and a status (to contact, messaged, replied, not interested). "Signed up" comes
  from the code being used. Nothing is sent automatically: messages go out by hand on X. No scraping or bulk
  emailing to collected addresses (X rules, NDPA consent, Resend's rules).
- **Founder emails**: `src/lib/founder-emails.ts` (pure templates, unit-tested) and
  `src/lib/email.ts` (sending). From "Rasheed from Meetwell" `<noreply@meetwell.me>`, reply-to
  `support@meetwell.me`, with Rasheed's photo (`public/founder/rasheed.jpg`).
- **Logo in emails and inboxes**: every email starts with `emailLogo()` (`public/email/logo.png`, a PNG
  because Gmail blocks SVG). Inbox sender picture uses BIMI: `public/bimi/meetwell.svg` (SVG Tiny PS) and a
  `default._bimi` TXT record; DMARC must be `p=quarantine` or stricter. Yahoo/AOL show it for free; Gmail and
  Apple need a paid VMC/CMC certificate (not bought yet).
- **Announcements**: one-off emails from the founder to every confirmed member, sent from the
  admin area ("Send Spark email", in paced batches; click again for the rest). Each person gets each
  announcement once (`public.announcements_sent`, `20261102000000_announcements.sql`). Template:
  `sparkBetaEmail` in `src/lib/founder-emails.ts`.
- **Changelog**: big new features only, with Rasheed's OK (see Deploying). `/changelog` is built from `CHANGELOG.md` (`src/lib/changelog.ts` reads the small
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

## Test database

Local dev uses a **separate Supabase project, `meetwell-test`** (set up 23 Oct 2026), never the live one.
`.env.local` points at it (its URL, publishable key and its own `CRON_SECRET`); the live values are kept in
`.env.live-db.local` (gitignored) for the rare case you need them. Sentry is off locally.

- **Set up or rebuild:** `npm run test-db:sql` writes `docs/private/test-db-setup.sql` (every migration plus a
  fresh cron secret and the reusable access code `TESTMEETWELL`) and the secret to
  `docs/private/test-db-cron-secret.txt`. Paste the SQL into the **test** project's SQL Editor on an empty
  database, then copy the secret into `CRON_SECRET` in `.env.local`.
- **New migrations:** run them on the test project yourself with `npm run test-db:run -- <file.sql>` (uses
  `TEST_DATABASE_URL` in `.env.local`, the test project's session pooler; the script refuses any other
  project), check they work, then give Rasheed the SQL for live. He only ever runs SQL on live.
- **Accounts:** test logins are in `docs/private/test-db-accounts.md` (test admin `admin+test@meetwell.me`, made
  admin with `insert into public.admins`). If "Confirm email" is on in the test project, confirm a new test
  account with `update auth.users set email_confirmed_at = now() where email = …` in the test project.

## Testing payments locally

Tested end to end on 22 Oct 2026 (credits and a mentor subscription). Use a Paystack **test** key in
`.env.local`, run `npm run dev -- --port 3100`, and use the LAN address in `NEXT_PUBLIC_SITE_URL`
(http://192.168.1.144:3100) so Paystack returns to it. Test card 4084 0840 8408 4081, 12/30, CVV 408, PIN 0000,
OTP 123456. This all lands in the test database. Never put a test key on the live site. Withdrawals can't be
tested until Paystack Transfers are enabled.

## Deploying

1. Get Rasheed's explicit OK.
2. **Changelog: big new features only, with Rasheed's OK first.** It's for features like Spark,
   payments/credits or the QR code, never small changes (forms, dropdowns, copy, layout, fixes).
   Only when a deploy ships a real new feature, draft an entry in chat (`## D Month YYYY: Title`,
   a few plain bullets) and wait for his OK. `npm run check:changelog` prints a reminder listing
   member-facing changes; it never blocks. The `/changelog` page rebuilds from the file on deploy.
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

- **Payments are live** (22 Oct 2026): Paystack Registered Business (Meet Well Limited), live key in Vercel,
  webhook working (a real ₦2,500 purchase was confirmed by webhook, then refunded and marked `refunded`).
  Before the first mentor withdrawal: Transfers on, transfer OTP off, money in the Paystack balance.
  Refund records: set `payments.status = 'refunded'` and add a negative `credit_ledger` row (reason `refund`)
  rather than deleting real payments.

- Talk to the first invited users; invite the next batch from /admin.
- Lawyer review of Terms and Privacy.
- Optional: delete meetwell.me from ImprovMX (no longer used).
- Ideas waiting on user feedback: printable QR card, simpler onboarding, stats on each
  user's own dashboard, paid plans (e.g. Paystack).
- Optional: add `ANTHROPIC_API_KEY` in Vercel for Claude-written match reasons.
- CAC done (Meet Well Limited): LICENSE and README now name the company as copyright holder. Still to do:
  a written transfer of the code and brand from Rasheed to the company (lawyer). Paystack is upgraded.
