# Meetwell — QR networking cards

> Meet someone. Make it a connection.

A web MVP where people create a digital networking card, share it as a QR code, and help whoever scans it save their contact, open their links, and start a conversation with an editable, profile-aware message.

**Stack:** Next.js 16 (App Router, Server Actions, `proxy.ts`) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Zod · `qrcode` · Vitest + PGlite.

"Meetwell" is a placeholder name. Change it in `src/lib/config.ts` (`APP_NAME`, `SUPPORT_EMAIL`).

---

## 1. Setup

### Requirements
- Node.js 20.9+ (tested on 24)
- A Supabase project (free tier is fine)

### Steps

1. **Install**
   ```bash
   npm install
   ```
2. **Create a Supabase project** at [supabase.com](https://supabase.com/dashboard).
3. **Run the migration.** Open *SQL Editor*, paste the contents of `supabase/migrations/20261017000000_init.sql`, and run it. (Or use the CLI: `supabase link` then `supabase db push`.)
4. **Configure Auth** (*Authentication → URL Configuration*):
   - **Site URL:** `http://localhost:3000` (your production URL later)
   - **Redirect URLs:** add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`
   - Email confirmation is on by default; keep it on. For production, configure custom SMTP (Supabase's built-in sender is rate-limited).
5. **Environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the publishable key) from *Project Settings → API*. **Never** add the `service_role` key — the app does not need it.
6. **Run**
   ```bash
   npm run dev
   ```

### Email templates (recommended)
Supabase's default links only finish signing in on the browser that started sign-up, so they fail when people open the email on another device or inside the Gmail/Outlook app. Switch to `token_hash` links, which work anywhere. In *Authentication → Emails → Templates*, replace the link URL:

- **Confirm signup:** `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
- **Reset password:** `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`

(`RedirectTo` already contains `/auth/callback?next=…` from the app.)

### Optional: event retention
Engagement events are meant to be kept for 13 months. With the `pg_cron` extension enabled:
```sql
select cron.schedule('purge-profile-events', '0 3 * * *', 'select public.purge_old_profile_events()');
```

## 2. Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests + database security tests (runs the real migration in an in-process Postgres) |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run lint` | ESLint |

## 3. Deploying to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and **`NEXT_PUBLIC_SITE_URL=https://your-domain`**.
3. Add `https://your-domain/auth/callback` to Supabase redirect URLs and set the Supabase Site URL to your domain.
4. **Choose your final domain before printing QR codes.** QR codes encode `NEXT_PUBLIC_SITE_URL/p/<slug>`; changing domains later breaks printed codes unless you redirect the old domain.

## 4. Architecture

```
src/
  app/
    page.tsx                  Landing page
    (auth)/                   sign-in, sign-up, forgot-password, reset-password
    auth/callback/route.ts    Email link handler (PKCE code or token_hash)
    onboarding/               Step-by-step setup wizard
    dashboard/                Overview, Edit card, QR code, Settings (+ QR and vCard downloads)
    p/[slug]/                 Public profile, its vCard route and not-found state
    api/v1/profiles/[slug]/   Versioned public JSON contract (for future mobile clients)
  components/
    ui/                       Design system: Button, Field/Input, Switch, Dialog, Toast, Badge, Card…
    profile/                  ProfileView (public card), ConversationStarter, analytics tracking
    editor/                   Profile editor (wizard + edit modes), sections, avatar upload
    dashboard/, marketing/, auth/, icons/
  lib/
    supabase/                 Server, browser and proxy clients
    profiles/                 Data access (queries.ts), server actions (actions.ts), types, constants
    starters/                 Conversation starter generator interface + template implementation
    validation.ts             Zod schemas, URL/phone normalisation
    vcard.ts, qr.ts, rate-limit.ts, config.ts
  proxy.ts                    Session refresh + optimistic route protection
supabase/migrations/          Schema, RLS, RPCs, storage policies
tests/                        unit/ and db/ (RLS) tests
```

### Data model
- **profiles** — one per user; `slug` (unique, locked once first published), `status` (`draft | published | unpublished`), `website_is_public`, `networking_goals[]`.
- **contact_methods** — `email | phone | whatsapp`, `is_public` (defaults to private).
- **social_links** — allow-listed platforms, `https://` only, `is_public`.
- **profile_events** — anonymous counters: `profile_id`, `event_type`, `source (qr | link)`, `created_at`. No IP, user agent or visitor id.

### Security model
- **Base tables are owner-only.** RLS restricts every operation to `user_id = auth.uid()`; `anon` has no table grants at all.
- **Public reads go through one function**, `get_public_profile(slug)` (security definer), which returns only published profiles and only public fields. The public page, metadata, vCard and JSON API all use it, so private data never reaches public HTML or payloads.
- **Writes** are Server Actions that verify the session, validate with Zod, and rely on RLS. Child rows are replaced atomically via `replace_profile_children` (runs with caller rights).
- **Inputs** — URLs must be http(s) (socials https-only and must match the platform's domain); DB check constraints repeat the critical rules. Avatar URLs must point to this project's storage bucket (blocks server-side request forgery when embedding photos in vCards).
- **Storage** — users can only write inside `avatars/<their-user-id>/`.
- **Rate limiting** — in-memory limits on sign-in/up, password reset, saves and events, plus a database-side burst guard on events. Supabase Auth adds its own limits. For multi-instance production, back `src/lib/rate-limit.ts` with Redis (e.g. Upstash).
- **Deletion** — unpublish (instant), delete card, or delete account (`delete_own_account()` cascades everything; avatar files are removed first).

### Conversation starters
`StarterGenerator` (`src/lib/starters/types.ts`) is an async interface. The MVP ships `templateGenerator`: deterministic, profile-aware templates that run in the visitor's browser (nothing is sent to the server). To add AI later, implement the same interface (e.g. call a `/api/v1/starters` route that holds the API key server-side) and pass it to `<ConversationStarter generator={…} />`. Every implementation must keep the contract: short editable drafts, no invented shared history, no claim of having met unless the visitor picked "Follow up after meeting".

## 5. Acceptance criteria status

Verified with automated tests (`npm test`: 39 tests, including 21 that run the real migration in Postgres), a production build, and browser checks. **Full end-to-end runs against a live Supabase project have not been done yet** because no credentials were available — see "Still to verify".

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Create an account and publish a profile | Built. Sign-up → email confirm → onboarding → publish. Needs a live check with Supabase. |
| 2 | Unique, permanent public URL | ✅ DB tests: unique slug, format check, locked after first publish |
| 3 | QR resolves to that profile | Built. QR encodes `SITE_URL/p/<slug>?src=qr`. Needs a live scan check. |
| 4 | Open on mobile without an account | ✅ Public route needs no auth; mobile layout checked at 375px |
| 5 | Private fields hidden | ✅ DB tests (public RPC, RLS, anon denied) + unit tests (vCard, preview) |
| 6 | Email/phone/social links open the right action | ✅ Unit-tested `mailto:`, `tel:`, `sms:`, `wa.me`, https links |
| 7 | Valid vCard download | ✅ Unit-tested vCard 3.0 output (escaping, folding, public fields only). Needs a live import test on iOS/Android. |
| 8 | Pick an intent → relevant message | ✅ Unit tests + browser check |
| 9 | Edit and copy the message | ✅ Browser check (edit, try another, copy, email shortcut) |
| 10 | Edits persist and appear publicly | Built (save → revalidate). Needs a live check. |
| 11 | Unpublished/deleted profiles are not public | ✅ DB tests + not-found page checked |
| 12 | One user can't modify another's profile | ✅ DB tests (update, delete, insert-as-other, child-row injection) |
| 13 | Works on current mobile and desktop browsers | Checked in Chromium at 375px and 1024px. Safari/Firefox not yet tested. |
| 14 | Handles loading, errors, missing profiles, invalid input | ✅ Loading skeletons, error boundaries, not-found states, field-level validation errors |

### Still to verify (needs Supabase credentials)
- Full sign-up → confirm email → onboarding → publish → scan → save-contact flow
- Avatar upload to Storage, password reset email flow, account deletion
- vCard import on iOS and Android; QR scanning from print

## 6. Roadmap to mobile

**P1 (web, next)**
1. Run the live end-to-end checklist above; fix whatever it turns up.
2. Installable PWA (manifest, icons, offline QR screen so the code shows without a signal).
3. Distributed rate limiting (Upstash) and CAPTCHA on sign-up if abuse appears.
4. Simple analytics charts (views over time), more starter templates, light custom themes.
5. Apple/Google Wallet pass containing the QR code.

**Phase 2: mobile app (React Native / Expo)**
1. Reuse Supabase Auth (same project) and the `get_public_profile` / `/api/v1` contract; move server-action logic into shared service functions or versioned API routes callable with a bearer token.
2. Screens: sign-in, my card + full-screen QR (brightness boost), edit profile, share sheet, stats.
3. Native contact save (expo-contacts) and in-app scanning that opens profiles natively.
4. Deep links / universal links for `/p/<slug>` so scans open the app when it's installed.

**Phase 3: networking features**
Two-way contact exchange, saved connections with notes, follow-up reminders, event-specific cards, AI-assisted introductions (behind the `StarterGenerator` interface), team profiles.

---

## License

Copyright (c) 2026 Meet Well Limited (RC 9952279), Nigeria. **All rights reserved.** This repository is public for viewing only; it is not open source. See [LICENSE](LICENSE).
