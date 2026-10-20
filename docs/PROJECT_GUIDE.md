# Meetwell project guide

Context for anyone (human or AI) picking up this project. Last updated October 2026.
Read this before changing anything.

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

## What Meetwell is

A networking card with its own QR code. Someone scans it with their phone camera (no app),
saves the contact in one tap (vCard), and gets a ready-made, editable first message.
Live at **https://meetwell.me**. Built in Lagos, Nigeria.

Status: **private beta**. Public sign-up is closed. People join a waiting list; Rasheed
invites them from an admin page; they sign up with a personal access code.

## Stack and services

| Piece | What it is | Notes |
| --- | --- | --- |
| Code | Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript, Tailwind 4 | GitHub: `Abdur-rasheedidris19/meetwell` |
| Hosting | Vercel, project `meetwell` | Auto-deploys on push to `main`. Domain `meetwell.me` (DNS on Vercel) |
| Database, auth, storage | Supabase | RLS everywhere; public reads only through security-definer RPCs |
| App emails | Resend (`noreply@meetwell.me`) | Via Supabase SMTP (auth emails) and the Resend API (founder emails) |
| Mailbox | Zoho Mail: `info@meetwell.me`, alias `hello@meetwell.me` | MX, SPF (`include:zohomail.com`) and DKIM (`zmail._domainkey`) on Vercel DNS |
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
| `CRON_SECRET` | Vercel (production, sensitive) | Protects the daily reminders job. Must equal `internal_settings.cron_secret` in Supabase |

## Key features and where they live

- **Landing page**: `src/app/page.tsx`, `src/components/marketing/*`. Hero photo
  `public/hero/hero-photo.webp`. Link preview image `src/app/opengraph-image.png` (a
  screenshot of the hero; retake it if the hero changes).
- **Private beta switch**: `SIGNUPS_OPEN` in `src/lib/config.ts` (false). The database also
  enforces invite-only sign-up (see access codes).
- **Waiting list**: `/early-access`, `joinWaitlist` in `src/lib/auth/actions.ts`. Duplicate
  emails show an error. New joiners get a founder welcome email.
- **Access codes**: `/access-code` (prefilled from `?code=`). A trigger on `auth.users`
  refuses new accounts without a valid code and uses it up. Codes live in
  `public.access_codes`. To reopen public sign-up later: make `public.invite_only()` return
  false and set `SIGNUPS_OPEN = true`.
- **Log in page**: `/sign-in` shows the private beta chooser; `?method=email` shows the form.
- **Cards**: public card `/p/[slug]` (`src/components/profile/profile-view.tsx`) with a
  floating green "Try it for free" bar. Editor in `/dashboard/profile`.
- **QR codes**: `src/lib/qr.ts`. Error correction H with the Meetwell logo in the middle; PNG
  rendered with `sharp`. The QR encodes the profile URL only.
- **Admin (Invites tab)**: `/dashboard/invites`, visible only to admins (`public.admins`).
  Waiting list with Invite/Resend, Members with card status, photo, views, QR scans, saves and
  reminder tags. Database functions refuse non-admins.
- **Founder emails**: `src/lib/founder-emails.ts` (pure templates, unit-tested) and
  `src/lib/email.ts` (sending). From "Rasheed from Meetwell" `<noreply@meetwell.me>`, reply-to
  `hello@meetwell.me`, with Rasheed's photo (`public/founder/rasheed.jpg`).
- **Automatic reminders**: `src/app/api/cron/reminders/route.ts`, scheduled in `vercel.json`
  (08:00 UTC daily). `public.claim_reminders()` picks who is due and records each send in
  `public.reminders_sent`, so every reminder goes out at most once per person:
  unused invite (3 days), unconfirmed email (1 to 14 days, Supabase re-sends), draft card
  (2 days), published but no QR scans (7 days).
- **Nightly clean-up**: `pg_cron` job `purge-profile-events` (03:00 UTC) deletes engagement
  events older than 13 months, as the Privacy notice promises.
- **Legal**: `/terms` and `/privacy`, written for Nigerian law (Constitution s.37, NDPA 2023,
  FCCPA 2018). Not yet reviewed by a lawyer; registered business name and RC number not added.

## Database migrations

All files in `supabase/migrations/` have been run in production, in order, as of the date
above (the `add_networking_goal` one is harmless if unsure). For any new migration: write the
file, add a database test, then give Rasheed the SQL to run, and confirm from outside.

Supabase grants EXECUTE on new functions to `anon` by default, and `revoke ... from public`
does not remove that. Revoke from `anon` explicitly for anything visitors must not call.

## Open items

- Talk to the first invited users; invite the next batch from the Invites tab.
- Lawyer review of Terms and Privacy; add registered business name and RC number.
- Optional: delete meetwell.me from ImprovMX (no longer used).
- Ideas waiting on user feedback: printable QR card, simpler onboarding, stats on each
  user's own dashboard.
