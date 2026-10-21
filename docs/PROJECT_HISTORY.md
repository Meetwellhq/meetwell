# Meetwell project history

How Meetwell was built (October 2026), what the founder asked for and why, and the lessons
learned along the way. Written so a new contributor or AI assistant can continue without
re-asking settled questions. Read [PROJECT_GUIDE.md](PROJECT_GUIDE.md) first for the current
technical picture; this file is the "why".

No personal data or secrets belong in this file: the repo is public.

---

## Working with Rasheed (the founder)

- **Deploys need an explicit yes, every single time.** Pushing to `main` is a production
  deploy. Commit locally, show what changed, ask. Approval for one deploy never carries over.
- He is non-technical. Give **plain-language, numbered steps**, say exactly where to click,
  and give **complete SQL to paste** (never placeholders that look like real values: he once
  saved a placeholder as a secret). After he runs anything, verify it from outside.
- He iterates visually and fast, often sending a screenshot or a short instruction mid-task
  ("make it 6px", "smaller", "remove the arrow", "try again"). Make the change, show a
  screenshot or rendered preview, commit locally, and ask before deploying.
- He prefers decisions be recommended, not listed. When something is genuinely his call,
  ask one clear question with a recommended option.
- Copy should sound human: short sentences, no long dashes, no stacked "X, Y and Z" phrases,
  nothing that reads as AI-written.

## Design preferences (settled)

- Brand green `#1f4d3f` (Tailwind `accent`), soft green `accent-soft`. Fonts: Geist for UI,
  Instrument Serif for display headings (green italic accent phrase in the hero).
- Buttons: standard **8px** corners (`rounded-lg`). He rejected pill buttons on auth pages.
- Landing: white background, no section outlines, big serif headline, highlight pills
  (rounded, short 2–3 word labels with icons), hero photo below the text (office
  conversation photo, 16px corners, hidden on mobile), "Join early access →" CTAs with a
  right arrow.
- Auth pages (log in, access code, early access): framed narrow column with dividing bands,
  modelled on a reference screenshot he liked.
- Public card: floating green "Try it for free" bar (Meetwell logo left, CTA right), 48px
  tall, 6px corners, light shadow.
- QR codes carry the Meetwell logo in the middle (error correction H).
- Emails: personal notes from "Rasheed from Meetwell" with his photo in the sign-off; replies
  go to support@meetwell.me (hello@ until 21 Oct 2026). Emails come from a no-reply address, so they say where to write.
  Match email card: soft green background, no outline, white "Why we matched you" box,
  "Say hello to {name} →" button, profile photo or initials. He asked to remove a QR code
  from the match email in favour of a single CTA.
- Link previews show a screenshot of the landing hero (retake it if the hero changes).
- Footer: "© {year} Meetwell. All rights reserved."

## Timeline of what was built

1. **MVP**: networking card, public profile `/p/[slug]`, vCard save, QR code, conversation
   starters, analytics events, dashboard, Supabase with RLS, tests (Vitest + PGlite).
2. **Launch**: Vercel hosting, meetwell.me domain bought on Vercel, Resend for email
   (Supabase auth emails use `token_hash` links so they work across devices).
3. **Card tweaks**: single networking goal, icon-only contact row, Android save-contact fix
   (Android Chrome downloads the vCard, so a hint is shown), duplicate-email sign-up fix.
4. **Landing redesign** over many iterations (see design preferences).
5. **Private beta**: sign-up closed (`SIGNUPS_OPEN = false`), waiting list with founder welcome
   email, invite-only sign-up enforced in the database by access codes, new log-in page.
6. **Legal**: Terms and Privacy rewritten for Nigerian law (Constitution s.37, NDPA 2023,
   FCCPA 2018, Cybercrimes Act, Evidence Act, Arbitration and Mediation Act). Minimum age 18.
   Not yet lawyer-reviewed.
7. **Admin tools**: Invites tab (invite from the waiting list with personal single-use codes,
   resend), Members section (card status, photo, views, QR scans, saves, active users).
8. **Automatic one-time reminders** (daily Vercel Cron): unused invite, unconfirmed email,
   draft card, no QR scans, and later profile under 80%. Reminder tags on the admin page.
9. **Security hardening**: internal and admin database functions revoked from `anon`
   (Supabase grants new functions to `anon` by default).
10. **Brand assets**: logo PNGs (kept locally in `brand/`, not committed), link preview image.
11. **Zoho Mail** for info@meetwell.me (alias hello@), replacing ImprovMX forwarding.
12. **Company accounts**: everything moved under company ownership; GitHub repo moved to the
    `Meetwellhq` org and made public (Vercel Hobby can't deploy private org repos), with an
    all-rights-reserved licence.
13. **Waiting-list updates**: people are told they'll get occasional updates; one-click
    unsubscribe that keeps them on the list.
14. **"Feature a member" email** was built, then scrapped before launch in favour of matching.
15. **AI Network Matching** (current headline feature), shaped by these decisions:
    - One-way: only the less experienced person is told.
    - Email + a Matches page in the dashboard.
    - Started as 5 a month for free users; changed to **no cap, at most one a day**; then back to
      **5 free a month** (still at most one a day).
    - Recommend **more experienced** people only; later **only people with 4+ years** and later
      still **only those with a profile photo**.
    - Only members with a confirmed account and a profile **at least 80% complete** take part,
      as receivers or recommendations.
    - Profile reminder copy differs for 4+ years without a photo ("people want to learn from
      you") and others ("a photo gets you matches").
    - Claude (`claude-opus-5-5`, low effort, structured output) chooses from a rule-ranked
      shortlist and writes the reason; falls back to rules without an API key.
    - Paid plans with more matches were discussed for later (e.g. Paystack), not built.
    - Named **Spark** for members ("Spark introduces you to someone a step ahead of you").
      "Gravity" was tried and rejected. Release notes live in `CHANGELOG.md`.

## Lessons and gotchas

- **Windows + Git Bash**: many files have CRLF line endings; scripted string replacements must
  normalise line endings first (or use the Edit tool). Heredocs mangle backslashes and
  apostrophes in inline JS: write a script file instead.
- **Next.js 16**: run `npx next typegen` after adding routes, before `tsc`, or `PageProps<"/new">`
  fails. Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- **The local dev server** sometimes serves stale server actions or layouts after edits;
  restart it (`npm run dev -- --port 3100`).
- **Supabase**: new functions are executable by `anon` unless revoked explicitly. Changing a
  function's return type needs `drop function` first. Add new SQL alongside old functions when
  the live site still calls the old shape, so nothing breaks between the SQL step and deploy.
- **PGlite tests**: the auth stub has `created_at`, `email_confirmed_at`, `last_sign_in_at`,
  `raw_user_meta_data`. The publish date is locked by a trigger; disable the trigger in tests to
  backdate it. Tests share one database and run in order.
- **Email**: Gmail won't show images embedded in the email itself; use absolute public URLs.
  Avatars live in a public Supabase bucket. Resend's free tier rate-limits, so sends are paced.
- **Vercel**: Hobby plan limits (see guide). Runtime logs are kept only an hour, so check
  cron results in Resend's email list or the admin page instead. A push once failed to
  trigger a deploy; the fallback is in the guide.
- **Verifying production safely**: call RPCs with the public key and a wrong secret
  (expect "Not allowed") or the real secret with `p_limit: 0` (expect `[]`), so nothing is
  sent or recorded.

## Open items

See "Open items" in [PROJECT_GUIDE.md](PROJECT_GUIDE.md).
