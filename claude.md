# Project: VAgeWell Care — Module 1
> Standalone mobile PWA built to `requirements.txt`. NOT run through the global 13-step pipeline
> (per user direction: build to the requirements file, don't force the org CLAUDE.md ceremony).

## Architecture (locked)
- **Supabase-native**, no backend service. Next.js 16 PWA ↔ Supabase (Auth · Postgres+RLS · Storage · Edge Fn).
- Auth: phone + 6-digit SMS OTP, `auth.uid()`, RLS, 72h session.
- Admin booking notification (R3.4): **removed** (user, 2026-07-21). No email / edge fn — the payment
  proof lands in the private `payment-proofs` bucket and the admin reviews & clears it from the dashboard.
- Excel export: client-side (browser).
- Roles: `patient` / `staff` / `admin` (spec's `leaf_node` ≡ `staff`).

## Dropped (not in requirements)
Shared Feedback system · shared `employees`/`apps` auth · `model_configs`/LLM-admin screens ·
Redux Toolkit · Cloud-Run/pipeline mandate. (Design system UI kit is kept — genuinely reusable.)

## Decisions log
- **CF-1 → RESOLVED:** Supabase Auth (phone+OTP+RLS), NOT shared employees/apps. (user, 2026-07-21)
- **Backend → RESOLVED:** Supabase-native; export client-side. (user, 2026-07-21)
- **GO-2 (channel) → SUPERSEDED:** was Email (Resend/SendGrid); admin notification removed entirely. (user, 2026-07-21)
- **R3.4 email alert → REMOVED:** deleted the `notify-admin` edge fn, DB webhook, config block, all
  email/webhook env vars, and the `ADMIN_ALERT_EMAIL` / `EMAIL_SEND_FAILED` constants. Admin reviews the
  uploaded proof + clears payment from the dashboard (pull-based, not push). (user, 2026-07-21)
- **GO-3 (roles) → RESOLVED:** patient/staff/admin. (user, 2026-07-21)

## Open items (defaults folded in — adjustable, do NOT treat as final)
- **GO-1** service catalog: 6 seeded services, **placeholder prices** (Physio ₹1500 is the only confirmed one). One service per booking.
- **GO-4** OTP expiry/resend limits: Supabase defaults; dev fixed test codes in `config.toml`.
- **GO-5** rejection flow: rejected proof → `pending` (re-upload). Private bucket, 5 MB, png/jpg/webp.
- **GO-6** multi-day = consecutive (`start_date` + `num_days`).
- **GO-7** dependents: no hard cap; required Name/Age/Relationship/Contact.

## Build status — ALL PHASES COMPLETE
- [x] Phase 0 — scaffold, config, PWA, hygiene
- [x] Phase 1 — shared contract + schema + seed
- [x] Phase 2 — functions/triggers, RLS+grants, storage
- [x] Phase 3 — notify-admin edge function + webhook template  *(later REMOVED per user — R3.4 dropped)*
- [x] Phase 4 — frontend shell + DS + PWA
- [x] Phases 5–12 — all 8 screens + modals
- [x] Phase 13 — typecheck (0 errors) + production build (green) + security scan

## Verified locally
- `npx tsc --noEmit` → 0 errors. `next build` → all 10 routes compile & prerender.
- Secret scan: no service-role/secret in frontend; only NEXT_PUBLIC URL+ANON_KEY exposed.

## NOT runnable in this env (needs user action)
- No Docker / Postgres here → migrations + RLS + OTP + storage NOT executed. Run `supabase start`
  + `supabase db reset` on a machine with Docker, or link a hosted Supabase project.

## Known deferrals (documented, not blockers)
- Services catalog is seeded + DB/Studio-editable (RLS `svc_write_admin` supports a future admin UI);
  no dedicated Services-admin screen (not in the 8-screen PDF).
- `middleware.ts` works but Next 16 deprecates the name in favour of `proxy.ts` (warning only).
- Fixed a schema bug during build: `chk_method_status` now allows `direct → paid` (cash at visit).

## Post-build audit remediation (2 deep audits: frontend + data layer)
Audit verdict: fully wired, no stubs/mock/dead buttons; transactional core verified correct. Fixed:
- [x] BUG: `useMyBookings` now filters `.eq(account_id, uid)` (staff tab was showing all bookings).
- [x] Added missing CHECK constraints on `how_heard` + `relationship` (were bare text).
- [x] Bounded `num_days` (1–60) and `time_slot` (06:00–21:00) at the DB.
- [x] R3.5 server-side gate: booking snapshot trigger rejects insert if profile has no `full_name`.
- [x] Freeze `payment_proof_path` once `payment_status='paid'` (no post-settlement swaps).
- [x] Secured `notify-admin` edge fn with `x-webhook-secret` (NOTIFY_WEBHOOK_SECRET) + empty-key dev fallback.
      *(superseded 2026-07-21 — the entire notify-admin email feature was later removed.)*
- [x] Pruned dead code (useBooking, loginSchema, paymentSchema, titleCase, BookingAlertPayload, unused import).
Re-verified: `tsc` 0 errors, `next build` green, secret scan clean, 0 dangling refs.

## Context handoff
Build complete and compiling. **R3.4 admin email alert removed (user, 2026-07-21):** deleted the
`notify-admin` edge fn + `supabase/webhooks.sql`, the `[functions.notify-admin]` config block, all
email/webhook env vars in `.env.example`, and the `ADMIN_ALERT_EMAIL` / `EMAIL_SEND_FAILED` constants;
README/SETUP updated. Admin now reviews the uploaded proof + clears payment from the dashboard.
To run: follow README (supabase start → db reset → frontend npm run dev). Confirm the founding-admin
phone in `supabase/seed.sql`. Open GO items (GO-1 prices, GO-4/5/6/7) still have documented defaults —
confirm before production.
