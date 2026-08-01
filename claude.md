# Project: VAgeWell Care — Module 1
> Standalone mobile PWA built to `requirements.txt`. NOT run through the global 13-step pipeline
> (per user direction: build to the requirements file, don't force the org CLAUDE.md ceremony).

## Architecture (locked)
- **Supabase-native**, no backend service. Two separate apps share one Supabase project + one
  `shared/` data layer: **`mobile/`** (Expo/React Native, patient-only) and **`web/`** (Next.js 16,
  staff/admin-only). Neither embeds the other's role.
- Auth: phone + 6-digit SMS OTP, `auth.uid()`, RLS, 72h session — same gateway for both apps; role
  (read after verify) decides which app a given account is allowed into.
- Admin booking notification (R3.4): **removed** (user, 2026-07-21). No email / edge fn — the payment
  proof lands in the private `payment-proofs` bucket and the admin reviews & clears it from the dashboard.
- Excel/CSV export: client-side (browser), same `liveSheetRows()` builder shared by both apps.
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
- **GO-1** service catalog: 4 services. Physio Therapy ₹1,500 confirmed by the client (2026-07-24, migration
  0007). Nutrition / Para-Medical / Mental Wellbeing ₹800 still unconfirmed. One service per booking.
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

## Change round — admin + patient updates (user, 2026-07-22)
Implemented against `tsc` (0 errors). Metro/DB run + `0006` migration still pending on the user's machine.
- [x] **Services catalog swapped** → 4 services: Nutrition ₹800, Physio Therapy ₹1200, Para-Medical ₹800,
      Mental Wellbeing ₹800. New `supabase/migrations/0006_services_catalog.sql` deactivates the old 6
      (bookings.service_id is ON DELETE RESTRICT — can't delete) + upserts the 4. Mirrored in
      `supabase/seed.sql`, `supabase/install_all.sql`, and `SEED_SERVICES` in `shared/src/constants.ts`.
      **Requires applying 0006 (or `db reset`) on Supabase — not run in this env.**
- [x] **CSV/Excel download fixed on web** — `mobile/src/lib/export.ts` was native-only (expo-file-system +
      expo-sharing no-op on web → silent no-download). Added a `Platform.OS === "web"` Blob+anchor branch
      (DOM reached via `globalThis as any`); generalized `downloadSheet(rows, bookType, sheet, fileBase)`.
- [x] **DateField** rewritten as an in-app month-calendar `Modal` (was `@react-native-community/datetimepicker`,
      which doesn't render on web). Same props → DOB (ProfileScreen) + appointment start_date unchanged.
      Package still installed but no longer imported in code.
- [x] **Admin Payment Proofs module** — `mobile/src/screens/admin/AdminPaymentProofsScreen.tsx` (name +
      screenshot thumbnail, batch-signed URLs; taps open the existing `PaymentReviewModal`). Registered in
      `AdminNavigator` + `AdminStackParamList`; dashboard button added.
- [x] **Live Sheet = Medical records** — `useAllClinicalRecords` (shared) + Appointments/Medical toggle on
      `LiveSheetScreen` + `exportClinicalToCSV`. Staff RLS `clin_select` already permits reading all rows.
- [x] **Vitals entry gated to Para-Medical** — `AdminBookingCard` shows the "Vitals" action only when
      `service_name === PARA_MEDICAL_SERVICE`.
- [x] **Patient Health record trimmed** — `VitalsView` now shows only Sugar (glucose) + Blood Group tiles;
      history collapses to those two, drops empty "Record" rows, keeps the date. (BP/SpO2/conditions hidden.)
- **Not changed (clarified with user):** Role dropdown kept in `AdminPatientProfileScreen` (item 3); admin
      member-edit medical section kept (item 6 — the admin *profile* screen already shows no health record).

## Change round — client feedback PDF (user, 2026-07-24)
Source: `VAgeWell Care - Feedback Notes (1).pdf`. Verified with `tsc --noEmit` (0 errors) **and**
`expo export --platform web` (bundle green, logo + favicon emitted). **`0007` migration still pending
on the user's Supabase.**
- [x] **New logo** — `mobile/assets/logo.png` (client-supplied, 300×282, opaque white bg). New
      `ui/BrandLogo.tsx` renders it in a white rounded chip (the chip absorbs the baked-in white
      background — no keying, no matte fringe). Replaces the HeartPulse chip on Landing/Login/Register;
      also `app.json` `icon` + `web.favicon`. *Known cosmetic debt: source is non-square and < 1024px,
      so the app icon is padded/soft. Swapping in a 1024px square export is a one-file replacement.*
- [x] **Brand mark colour swapped** — Landing now reads `VAgeWell` teal + `CARE` black (was inverse).
- [x] **Copy** — Register subtitle "Your Care Journey Starts Here", name placeholder "Name", label "Age";
      Login "Together, We Move Towards Better Health."; Admin login "Together, we manage care, support
      people, and create a healthier future"; Services "Our services" / "Choose a service to begin your
      care journey."; Appointment "Request Personalized Care"; Appointments subtitle "Your Bookings";
      booking cards read `Patient <name>` (name in brand teal) on both patient + admin sides.
- [x] **Physio Therapy ₹1,200 → ₹1,500** — new `supabase/migrations/0007_physio_price.sql` (idempotent).
      Mirrored in `seed.sql`, `install_all.sql` (its services block is now an **upsert**, not
      `do nothing`, so re-running it repairs a stale catalog) and `SEED_SERVICES`. `0006` left untouched
      — it may already be applied; 0007 supersedes it. Existing bookings keep ₹1,200 (price is snapshotted).
- [x] **Booking completion added** — `useCompleteBooking()` (open → closed) + a **Complete** action on
      `AdminBookingCard`. No migration: the 0002 update guard and `bk_update` RLS already allowed staff
      `open → closed`; nothing in the UI had ever used it. `BOOKING_STATUS_META.closed` now labels
      "Completed" (was "Closed") to match the action.
- [x] **Patient Appointments** — only `open` bookings list; the most recent closed/cancelled one renders
      as a read-only **Last appointment** card (deliberately not `PatientBookingCard`, which carries
      Cancel/re-upload affordances).
- [x] **Admin Patients search now includes dependents** — new `useAllFamilyMembers(enabled)` +
      `qk.familyMembersAll`. Account holders and family members share one name-sorted, searchable list;
      dependents carry a "Family member" pill and tap straight through to `AdminMemberEdit`.
- [x] **Live sheet merged into one sheet** — Appointments/Medical toggle removed. `liveSheetRows()`
      in `mobile/src/lib/export.ts` emits the client's 18 columns + Booking ID / Symptom Brief / Created.
      Vitals are folded per subject taking the **most recent non-null value per field** (staff write one
      dated row per visit, so `records[0]` alone would blank earlier fields). Payment/appointment status
      use the human labels. Both the CSV download and the dashboard Excel export now call the same
      builder, so they are byte-identical.
- [x] **Profile** — vitals History list removed; Sugar + Blood Group tiles kept.
- **Cascade cleanup:** `clinicalRows` / `exportClinicalToCSV` / `ClinicalRecordWithNames` deleted;
      `useAllClinicalRecords` dropped its 3-way name join (nothing consumed it once the medical sheet
      went); `useAllBookings` gained `relationship / age / contact_phone` on the dependent embed and
      `age` on the account embed.

### Re-check pass (same day) — 4 issues found and fixed
- **`0007_physio_price.sql` was written empty** (0 bytes of SQL). Rewritten + content verified. *Lesson:
  read back any generated file that nothing else compiles or imports — `tsc` can't catch an empty .sql.*
- **`install_all.sql` upsert didn't retire the old catalog.** As a repair script it would have left the
  original 6 placeholder services active alongside the new 4. Now does `set active = false` first,
  matching 0006.
- **Profile tiles could blank a known value.** With History gone, `records[0]` was the only source — a
  visit that recorded sugar but not blood group hid a blood group captured earlier. `VitalsView` now
  reads the most recent **non-null value per field**, same rule as the live sheet.
- **Dashboard fetched the whole vitals ledger on every load** just to arm the Export button. Now
  `useAllClinicalRecords(false)` + `refetch()` on click (verified in query-core: `refetch()` calls
  `fetch()` with no `enabled` gate). Also fixed the patient empty state, which said "No appointments
  yet" to someone whose visits were merely finished.

## Change round — client feedback Doc2.pdf (user, 2026-07-24)
Six notes on admin dashboard / patient Appointments / live sheet. Verified `tsc --noEmit` (0 errors)
and `expo export --platform web` (bundle green). **`0008` migration pending on the user's Supabase.**
- [x] **Cancelled bookings are out of the payment workflow.** `AdminBookingCard` drops the **Review**
      action and the payment pill when `booking_status === 'cancelled'` (a cancelled visit showing
      "Pay at Visit" was the client's complaint); the divider row is skipped when no actions remain.
      `PaymentReviewModal` renders read-only for a cancelled booking — the proof image stays, the
      Reject / Mark Paid pair becomes a notice + Close. That matters because the modal is *also*
      opened from `AdminPaymentProofsScreen`, so gating the card alone left a second path.
      New `supabase/migrations/0008_cancelled_payment_guard.sql` closes the same hole in the DB:
      0002's `verify_payment` / `reject_payment` gated on `payment_status` only, so a cancelled
      booking could still be settled. Mirrored into `install_all.sql`. `create or replace` preserves
      the 0002 ACLs, so the revoke/grant block is not repeated.
- [x] **Dashboard ordered by appointment date desc** — `useAllBookings` ordered `created_at desc`
      while every card/sheet row renders `start_date`, so the visible dates looked unsorted. Now
      `.order(start_date desc).order(created_at desc)`. Intentional cascade: payment proofs, live
      sheet and both exports are newest-appointment-first too.
- [x] **Dashboard search covers services** — `filtered` also matches `service_name`; label is now
      "Search by patient or service".
- [x] **Last appointment = completed only** — `DashboardScreen` took every non-open booking, so a
      *cancelled* one could headline "Last appointment". Narrowed to `booking_status === 'closed'`;
      cancelled bookings now leave the patient's tab entirely (confirmed with the user). Empty state
      keys off `hasAny` rather than `last`, so anyone who has ever booked reads "No upcoming".
- [x] **Back control between Appointment and Payment** — the patient tabs run `headerShown: false`
      and `PageHeader` had no back slot, so Payment was a dead end on web/PWA and iOS. `PageHeader`
      gained an optional `onBack` (ChevronLeft, mirrors `AdminHeader`); wired on Payment and, for the
      same dead end, Appointment. **Payment suppresses it while `busy` and once `createdId` is set** —
      the booking row already exists at that point (insert OK, proof upload failed), and a second pass
      through a freshly-mounted PaymentScreen would insert a duplicate.
- [x] **Live sheet search over all data** — `FormInput` + a "Showing N of M rows" counter; the filter
      matches each row's whole value set as text, so it covers every column including Booking ID and
      Symptom Brief. `exportAppointmentsToCSV` couldn't see the filter (it re-derived rows from
      `bookings`), so it was replaced by `exportRowsToCSV(rows)` taking pre-built rows; the button
      downloads exactly what's listed and is disabled on an empty result. Dashboard **Export** is
      untouched and still exports everything.
- [x] **New logo** — client's Photoroom cutout (395×418, real alpha) replaces `mobile/assets/logo.png`
      and the repo-root source copy. Because the mark is now transparent, a transparent app icon would
      render black-backed on iOS, so `app.json` `icon` points at a **new generated
      `mobile/assets/icon.png`** — 1024×1024, mark centred at 78% on white. That also clears the old
      "icon is padded/soft" debt. `web.favicon` stays on the transparent `logo.png` (adapts to the tab
      background). `BrandLogo`'s white chip is kept as a deliberate badge; its comment no longer
      claims the source has a baked-in white background.

## Bugfix — "Save profile goes to an undefined page" (user, 2026-07-24)
Patient **Profile → Edit details → Save** on the web/PWA: browser tab title flipped to the literal
string `undefined`, splash flashed, user was dumped on the Services tab. Frontend-only, no migration.
Verified `tsc --noEmit` (0 errors) + `expo export --platform web` (bundle green).

Root cause chain (verified against the installed `@react-navigation` v7 source, not from memory):
`saveBio` → `refreshProfile()` → `AuthProvider.loadProfile()` sets the **global** `profileLoading`
→ `RootNavigator`'s gate `if (loading || (user && profileLoading))` returned `<SplashScreen/>`,
unmounting the whole navigator. Two symptoms fell out of that one unmount:
1. `AppNavigator` remounted **fresh**, so the tab stack rebuilt from scratch and landed on the
   initial route (`ServicesTab`) — the "thrown off Profile" half.
2. With no navigator mounted, `NavigationContainer` still runs `useDocumentTitle`; its default
   formatter is `options?.title ?? route?.name` and `getCurrentRoute()` returns `undefined`
   (`BaseNavigationContainer.js`: `state == null → undefined`), so it executed
   `document.title = undefined` → the tab literally read **"undefined"**. The "undefined page" half.

- [x] **`RootNavigator`: gate the splash on *resolution*, not on *loading*.** Now
      `profileResolved = !!profile && profile.id === user?.id`, and the splash only shows while the
      **current** user's profile is still unknown. Keeps the original anti-flicker intent (patient
      shell must not flash before the role resolves) but a background refetch no longer tears down
      the tree. Keyed on `profile.id === user.id` rather than a bare `!profile` so a stale profile
      from a previous account can't count as resolved when a different-role account signs in.
- [x] **`App.tsx`: explicit `documentTitle` formatter** — `options?.title ?? "VAgeWell Care"`.
      Belt-and-braces: the splash is still legitimately rendered on cold start and sign-out, and
      both wrote `undefined` before. Also stops internal route ids (`AdminMemberEdit`) leaking into
      the browser tab/history. Keep the string in sync with `expo.name` in `app.json` by eye.
- [x] **`ProfileScreen.saveBio`**: `setEditing(false)` now runs *before* `void refreshProfile()`
      instead of awaiting it — polish, so the read-only rows appear without a second round-trip.
- **Wider fix, same root cause:** Supabase fires `onAuthStateChange` on `TOKEN_REFRESHED` (~hourly)
  and `AuthProvider` re-ran `loadProfile` there too, so the app used to remount and reset to the
  initial tab mid-session on a routine token refresh. That is gone as well.
- **Deliberately not touched:** `AdminMemberEditScreen.save()` — it never calls `refreshProfile`, so
  it cannot hit this bug (confirmed with the user that the admin path is not the reported symptom).
  It does carry a separate latent issue worth its own round: `finish()` (toast + `goBack()`) fires
  off the **clinical** mutation only, so a failed *bio* update still reports "Record saved".

## Context handoff
Latest: the **"Save profile → undefined page" bugfix** (2026-07-24) is implemented — `tsc --noEmit`
0 errors, web bundle green. Frontend-only, no migration, so it needs **no DB work** — just a runtime
click-through on the web build: Profile → Edit details → Save must keep the tab title
"VAgeWell Care" (never "undefined"), stay mounted on the Profile tab with the form collapsed to the
updated read-only rows, and no splash flash. Regression to re-check: hard-reload as a patient **and**
as a staff/admin account — the splash must still hold until the role resolves, with no flicker of
the patient tabs before the admin stack appears.

Doc2.pdf feedback round (2026-07-24) is implemented — `tsc --noEmit` 0 errors, web bundle green, the
new logo + generated icon bundle correctly. **Needs the user's machine:**
1. Apply `supabase/migrations/0006` (if never run), `0007_physio_price.sql` **and the new
   `0008_cancelled_payment_guard.sql`** — or `supabase db reset`.
   Verify: `select name, price_per_day from services where active` → Physio Therapy = 1500; then cancel
   a booking and call `select verify_payment('<id>')` → must raise *"booking is cancelled"* with
   `payment_status` unchanged.
2. Runtime click-through (no Docker/Postgres in the build env): cancelled card shows only the
   `Cancelled` pill with no Review; dashboard lists newest appointment date first; searching "physio"
   filters by service; live-sheet search + CSV row count; the back chevron returns from Payment to a
   still-filled Appointment form; admin **Complete** → booking leaves the patient list and reappears
   as *Last appointment*, while a cancelled one disappears.
3. The client's original `WhatsApp Image 2026-07-24 at 14.27.26-Photoroom.png` is still sitting in the
   repo root — delete it if you don't want the raw drop kept alongside `logo.png`.

Earlier context still current: **R3.4 admin email alert removed (2026-07-21)** — the `notify-admin`
edge fn, `supabase/webhooks.sql`, its config block, all email/webhook env vars and the
`ADMIN_ALERT_EMAIL` / `EMAIL_SEND_FAILED` constants are deleted; the admin reviews the uploaded proof
and clears payment from the dashboard instead. To run: follow README (supabase start → db reset →
`npm run start` in `mobile/`). Confirm the founding-admin phone in `supabase/seed.sql`.
GO-1 is now settled for Physio (₹1,500); GO-4/5/6/7 still carry documented defaults — confirm before
production.

## Change round — split into two apps (user, 2026-07-28)
User direction: "for customer (patient login) mobile app and staff, leaf node, admin are in the web
app" — confirmed as a genuine split into two separately deployable codebases (not just a description
of the existing single app). Verified: `mobile` `tsc --noEmit` 0 errors + `expo export --platform web`
bundles (2816 modules); `web` `tsc --noEmit` 0 errors, `eslint` 0 errors/warnings, `next build` green
(11 routes). **No DB migration** — reuses the existing schema/RLS/RPCs as-is; this is a frontend split.

- [x] **New `web/` — Next.js 16 staff/admin portal.** Scaffolded via `create-next-app` (App Router,
      Tailwind v4, TS). Same Supabase phone+OTP login (`/login` → `/verify`); a patient phone number
      that lands here is signed back out with a message (RLS is the real boundary — this is UX only,
      per R3.1). Pages: `/dashboard` (all appointments, search, date filter, export, review/vitals/
      complete), `/patients` + `/patients/[accountId]` + `.../self` + `.../dependents/[id]`
      (patient profile, role dropdown, bio+medical edit), `/payment-proofs`, `/payment-qr`, `/live-sheet`.
      `AppointmentCalendar`'s custom grid was not ported — the web dashboard's date filter is a plain
      `<input type="date">` instead, functionally equivalent for this scale.
- [x] **`shared/src/export.ts` (new).** `liveSheetRows()` (+ its vitals-folding helpers) moved out of
      `mobile/src/lib/export.ts` into `shared/` — it was pure business logic with zero RN dependency,
      and the web live-sheet/export needed the exact same row-shaping. Each app keeps its own thin
      `downloadSheet()` (Blob+anchor on web; the existing web/native branches on mobile).
- [x] **Tailwind brand parity.** `web/src/app/globals.css` mirrors `mobile/tailwind.config.js`'s teal
      remap and dark admin-surface palette as native Tailwind v4 `@theme` tokens (`brand-*`, `authbg`,
      `admin-*`) so the two apps read as one product.
- [x] **Two build-system gotchas, both from `@vagewell/shared` being a `file:../shared` symlink and
      not a real npm/yarn/pnpm workspace member:**
      1. `web/tsconfig.json` needed the same `baseUrl` + explicit `paths` for `@tanstack/react-query`,
         `@supabase/supabase-js`, `zod` that `mobile/tsconfig.json` already carries (TS resolves a
         symlink's *own* imports from its realpath, which has no `node_modules` of its own) — **this
         is what the original baseUrl question in this session turned out to be about.**
      2. Turbopack (Next 16's default) cannot resolve `@vagewell/shared` at all through the symlink
         (only real workspace packages get auto-transpiled); `transpilePackages` in `next.config.ts`
         didn't fix it either. Fix: `web/package.json` `dev`/`build` scripts pass `--webpack` explicitly.
- [x] **Mobile app made patient-only.** Deleted `AdminNavigator.tsx`, `screens/admin/*` (8 screens),
      `components/admin/*` (`AdminHeader`, `AdminScreen`, `AppointmentCalendar`), the admin-only
      `PaymentReviewModal`/`VitalsModal`, `lib/export.ts`, and the already-dead `ui/TabBar.tsx`.
      `RootNavigator` now shows a **"Staff & admin portal moved" notice + Sign out** for role
      staff/admin instead of mounting `AdminNavigator` (same shared OTP login, so a staff phone can
      still complete sign-in here — this is the dead-end that sends them to `web/` instead). Removed
      the "Admin Portal" entry from `LandingScreen`, the `Admin*` route types, the `ADMIN_*` theme
      constants and `admin-*` Tailwind colors (all now unused), `OtpInput`'s dead `variant="dark"`
      prop, and the now-unused `xlsx` dependency (`npm uninstall`).
- **Needs the user's machine:** `web/.env.local` currently holds placeholder Supabase values (this
  environment has neither Docker/Postgres nor a live project to point at, same constraint as always)
  — fill in the real `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` before deploying.
  Runtime click-through still needed: staff/admin OTP login on `web/`, a patient phone bouncing back
  out of `web/`, and a staff/admin phone bouncing to the new notice screen on `mobile/`.
  **Resolved same day:** real Supabase project connected (`ccvpwfzqgrrhxrmzlkca`) — both `.env` files
  hold the real URL/anon key now, not placeholders.

## Change round — platform expansion: leaf_node, household logins, assignment pipeline, reports (user, 2026-07-29)
User supplied a new end-to-end flowchart and confirmed it **supersedes** the earlier spec in several
places (see the full decision list in the approved plan, `C:\Users\arunb\.claude\plans\modular-meandering-aho.md`).
Net effect: **auth stays phone+OTP for everyone** (patients, staff, admin, and the new leaf_node role)
— no passwords, no email, no Edge Function, contrary to the flowchart's literal "Email/Password" boxes.
Verified: `web` `tsc`/`eslint`/`next build --webpack` all clean (15 routes); `mobile` `tsc --noEmit`
clean + `expo export --platform web` bundles. **`0009_platform_expansion.sql` (or the refreshed
`install_all.sql`) still needs to run in the Supabase SQL Editor** — not executed here, no
Docker/Postgres in this environment, same as every prior migration.

- [x] **New role: `leaf_node`.** `profiles.role` widened to `patient/staff/admin/leaf_node`.
      `is_staff()` redefined to cover all three operational roles (the shared elevated-access
      boundary); `is_admin()` stays the sole full-oversight gate. Onboarding is unchanged in kind:
      a new team member self-registers via phone+OTP (lands as `patient`), an admin promotes them via
      the existing role dropdown — now offering Leaf Node too. Zero new backend surface.
- [x] **Household-linked family logins.** `profiles.primary_account_id` + `family_members.linked_profile_id`
      + a new `in_household()` SQL helper. `handle_new_user()` now auto-claims a matching, unclaimed
      `family_members.contact_phone` row on signup, linking the new account to its primary. `bk_select`/
      `fam_select`/`clin_select`/`report_select` RLS all read through `in_household()` so a primary
      account keeps seeing a linked dependent's own bookings/records. Mobile: dependents show a
      "Has own login" / "Not registered yet" pill (`ProfileScreen`); registering as a family member is
      the same Register screen any patient uses — the linking is entirely server-side.
- [x] **Booking assignment pipeline.** `booking_status` replaces `open/closed/cancelled` with
      `requested → approved → assigned → in_progress → report_uploaded → completed` (or `cancelled` any
      time before `completed`). New `bookings.service_mode` (`clinic`/`home_care`) and `assigned_to`.
      `tg_booking_update_guard()` rewritten as an explicit per-transition permission table (admin-only
      for approve/assign; assigned member or admin for the rest). `bk_select` scopes plain staff/leaf_node
      to `assigned_to = auth.uid()`; admin still sees everything. Web: dashboard's **Approve & Assign**
      modal (`web/src/components/ApproveAssignModal.tsx`) replaces the old single-step "Complete" button;
      new `/my-visits` page (Start Visit → Vitals/Upload Report → Complete) for staff/leaf_node, reusing
      the existing `VitalsModal`. Mobile: patient cancel narrowed to `requested`/`approved` (was `open`);
      `isBookingTerminal()` (new, in `shared/format.ts`) replaces the old `'open'`/`'closed'` checks in
      `DashboardScreen`/`PatientBookingCard`.
- [x] **Pricing model split.** `services.pricing_model` (`per_day` | `flat_advance`). Nutrition & Physio
      Therapy → flat ₹2,000 advance regardless of days; Para-Medical & Mental Wellbeing stay ₹800/day
      (unchanged mechanism). `bookings.total_amount` **stopped being a generated column** — a service's
      pricing model can't be branched on from a same-row generated expression — now computed explicitly
      in `tg_booking_snapshot()` and snapshotted alongside `pricing_model` itself. Mobile
      `AppointmentScreen`/`PaymentScreen` branch their summary display on `pricing_model` (flat total vs
      `days × price`); `num_days`/date fields stay for scheduling even under flat pricing.
- [x] **Report uploads, admin-gated.** New `report_uploads` table + private `medical-reports` storage
      bucket. Staff/leaf_node upload from `/my-visits` (`ReportUploadModal`); an `AFTER INSERT` trigger
      auto-advances the booking to `report_uploaded`. Reports are `reviewed = false` until an admin
      releases them (`review_report()` RPC, new admin `/reports` page) — only then does `report_select`
      RLS let the customer's household see them. Mobile: new **Reports** tab (`ReportsScreen`,
      `AppTabsParamList` gained `ReportsTab`) lists released reports with a tap-to-open signed URL.
- [x] **Hospital Call button** — `HOSPITAL_CONTACT_PHONE` (placeholder, needs the real number) on
      `ServicesScreen`'s header, `Linking.openURL('tel:...')`.
- **Two lint fixes along the way** (same `react-hooks/set-state-in-effect` pattern hit twice already
  this project): `web/src/app/reports/page.tsx`'s signed-URL fetch moved from local state + effect to
  a `useQuery`, mirroring the earlier `payment-proofs` fix.
- **Not implemented (flagged, not guessed):** no real payment gateway ("Online Payment API" stays the
  existing UPI-QR + screenshot-proof flow — no credentials exist for a real gateway and none were
  requested); no Employee ID login (auth stays phone+OTP per the confirmed decision above).

## Change round — post-expansion fixes: crash hardening, role landing, admin uploads, live sheet (user, 2026-07-29)
User reported a mobile crash (`Cannot read property 'bg' of undefined`) after the platform-expansion
migration shipped — root cause: any booking/payment row still carrying a pre-migration status value
(e.g. old `open`/`closed`) has no entry in the new `BOOKING_STATUS_META`/`PAYMENT_STATUS_META` maps, so
the direct object-index crashed the whole bundle the moment such a row rendered. Running the refreshed
`install_all.sql` (still outstanding — see prior round) removes the stale data, but the lookup itself
was also fragile by construction, so it's fixed at the source too.

- [x] **Crash-proof status lookups.** New `paymentStatusMeta()`/`bookingStatusMeta()` in `shared/src/format.ts`
      fall back to a plain grey pill (labelled with the raw value) instead of indexing straight into the
      meta record. Replaced every direct `PAYMENT_STATUS_META[...]`/`BOOKING_STATUS_META[...]` call site
      across both apps (`mobile/src/components/feature/PatientBookingCard.tsx`, `mobile/src/screens/DashboardScreen.tsx`,
      `web/src/app/dashboard/page.tsx`, `web/src/app/my-visits/page.tsx`, `web/src/app/payment-proofs/page.tsx`,
      `shared/src/export.ts`) — a stray legacy value now degrades gracefully instead of crashing.
- [x] **Role-aware post-login landing.** `web/src/app/dashboard/page.tsx` (the hardcoded redirect target
      after `/verify`) now bounces non-admin ops roles to `/my-visits` once their profile resolves, instead
      of showing staff/leaf_node the full cross-account admin view (whose Approve/Assign actions would
      fail for them under RLS anyway).
- [x] **Admin can upload reports too.** `report_insert` RLS was already `is_staff()` (admin included) —
      only the UI was missing. Added an "Upload Report" action (reusing `ReportUploadModal`) to every
      non-`requested`, non-cancelled booking on the admin dashboard, so upload/scan/prescription capture
      now exists in all three ops panels (staff, admin, leaf_node), not just staff/leaf_node's `/my-visits`.
- [x] **Live sheet — Overall vs Updated view.** `web/src/app/live-sheet/page.tsx` gained a two-way toggle:
      "Overall Sheet" (unchanged, full column set) and a new "Updated Sheet" — a condensed view in the
      exact requested order (Account Holder, Appointment For, Patient Number, Service, Days/Months,
      Appointment Date, Payment Status, Appointment Status; "Date/Time" relabelled "Appointment Date" for
      this view only). CSV export downloads whichever view is active.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (15 routes); `mobile` `tsc --noEmit` clean +
  `expo export --platform web` bundles clean.
- **Still outstanding, unchanged from the prior round:** `install_all.sql` has not been run against the
  live Supabase project from this environment (no Docker/Postgres here) — the stale-status data causing
  the reported crash won't fully clear until that migration runs.

## Change round — login role picker, date-range filters, reports in health record (user, 2026-07-29)
User clarified an earlier bug report ("just directly entered into the staff panel, doesn't show the
role") via a follow-up question: they want **one login page with a role picker** (Admin/Staff/Leaf
Node), not separate access reads purely off the DB with no visible choice. Phone+OTP itself is
unchanged — the picker is a front door, not a new access-control mechanism (RLS/`RequireStaff` remain
the real gate).

- [x] **Role picker on `web/src/app/login/page.tsx`.** Three buttons (Admin/Staff/Leaf Node, from
      `OPS_ROLES`/`ROLE_LABELS`) select a role that's passed to `/verify` as a query param.
      `web/src/app/verify/page.tsx` now fetches the account's real `profiles.role` right after
      `verifyOtp` and compares it to the pick: a mismatch signs the session back out with an explicit
      "This number is registered as X, not Y" error instead of silently landing somewhere unexpected;
      a match routes straight to `/dashboard` (admin) or `/my-visits` (staff/leaf_node) — no more
      hardcoded `/dashboard` for everyone. `RequireStaff` stays as the enforcement backstop for anyone
      who deep-links in without going through `/login`.
- [x] **Date range filters.** `web/src/app/dashboard/page.tsx`'s single "Filter by date" box replaced
      with From/To fields (inclusive range over `start_date`). `web/src/app/live-sheet/page.tsx` gained
      the same From/To range (it had no date filter before, only search) — it filters the underlying
      bookings before either sheet view is built, so both Overall and Updated sheets respect it.
- [x] **Reports surfaced in the customer Health record.** `mobile/src/screens/ProfileScreen.tsx`'s
      existing "Health record" card (vitals, subject-scoped self/dependent) now also lists that
      subject's released reports underneath the vitals tiles — reports don't carry a subject column, so
      they're matched through their booking's `family_member_id` via `useMyBookings()`. The standalone
      Reports tab is unchanged (still shows every released report across the household in one place);
      this is additive, not a replacement.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (15 routes); `mobile` `tsc --noEmit` clean +
  `expo export --platform web` bundles clean.
- **Still outstanding, unchanged from prior rounds:** `install_all.sql` not yet run against the live
  Supabase project from this environment.

## Change round — drop standalone customer Reports tab, simplify Services cards (user, 2026-07-29)
Now that released reports show inside the customer's Health record (previous round), the user asked to
drop the separate Reports tab entirely — one place to see reports, not two. Also asked to declutter the
Services screen: no separate price/pricing-model block on each card, and the Nutrition/Physio "advance"
booking should use the exact same Book action as every other service (no separate flow), landing at the
end of the list.

- [x] **Removed the customer `ReportsTab`.** Deleted `mobile/src/screens/ReportsScreen.tsx`; removed
      `ReportsTab` from `AppTabsParamList` (`navigation/types.ts`) and its `Tabs.Screen` registration
      (`navigation/AppNavigator.tsx`). `useMyReports` stays in use (now only from `ProfileScreen`'s
      Health record).
- [x] **Simplified `ServicesScreen` cards.** Removed the separate top-right price/"advance"/"per day"
      block; the price and pricing model now live in the Book button's own label instead (e.g.
      "Book · ₹2,000 advance" / "Book · ₹800/day") — one action per card, not a display block plus a
      separate button. No sort change was needed: `useServices()` already orders by `price_per_day`
      ascending, so the ₹2,000 flat-advance services (Nutrition, Physio) already land after the ₹800
      per-day ones — i.e. at the end of the list, same Book flow as everything else, nothing separate.
      The existing "Add a family member" footer (already at the very end of the list) is unchanged.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — single Book action, hide day count for flat-advance, report dates, hospital number (user, 2026-07-29)
Follow-up correction to the previous Services-screen change: the user actually wanted the per-card Book
button gone entirely, not just relabeled — one Book action for the whole list, at the bottom, right above
Add a family member.

- [x] **One Book button, not four.** `mobile/src/screens/ServicesScreen.tsx` cards are now tap-to-select
      (purple border + checkmark when selected, price/pricing model shown as plain text) with no
      per-card button. A single `PrimaryButton` in the list footer ("Book Appointment") navigates to the
      Appointment screen with whichever service is selected; tapping it with nothing selected shows a
      toast instead of guessing. "Add a family member" sits directly below it, same as before.
- [x] **Flat-advance services skip the day count.** `mobile/src/screens/AppointmentScreen.tsx` hides the
      "Number of days" field when the selected service is `flat_advance` (Nutrition, Physio) — Start date
      alone spans the row. The two `per_day` services (Para-Medical, Mental Wellbeing) keep asking for
      it, unchanged. Submission forces `num_days = 1` for flat-advance regardless of any stale value left
      from a previously selected per-day service, rather than trusting a hidden field's leftover state.
- [x] **Report upload date labelled everywhere it appears.** Admin `/reports` and the customer Health
      record both now read "Uploaded: <date>" instead of a bare timestamp. Also newly surfaced on the
      ops side, using the previously-unused `useReportsForBooking()` hook: `web/src/app/my-visits/page.tsx`
      (staff/leaf_node) and `web/src/app/dashboard/page.tsx` (admin) booking cards now show "Report
      uploaded: <date>" once one exists for that booking.
- [x] **Real hospital number.** `HOSPITAL_CONTACT_PHONE` (`shared/src/constants.ts`) changed from the
      `+911234567890` placeholder to `+919342703376`; the customer Services screen's call button already
      dials this constant, no other change needed.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (15 routes); `mobile` `tsc --noEmit` clean +
  `expo export --platform web` bundle clean.

## Change round — wording, upload visibility, confirmed booking flow (user, 2026-07-29)
User confirmed via clarifying questions: (1) `install_all.sql` **has** been run against the live
Supabase project, so the earlier "no uploading reports option" report is not a schema-drift issue — the
button exists but was gated behind a visit stage the user hadn't reached; (2) the Services screen's
select-a-card-then-one-Book-button flow (previous round) is the one to keep, not a book-first-select-
after flow — no structural change made there.

- [x] **Upload Report visible earlier in `web/src/app/my-visits/page.tsx`.** Previously gated behind
      `inFlight` (`in_progress`/`report_uploaded`) alongside Vitals and Complete, so a staff/leaf_node
      member had to tap **Start Visit** before Upload Report ever appeared — the likely cause of "no
      uploading reports option" once schema drift was ruled out. Upload Report now also shows while
      `assigned` (before the visit is started); Vitals and Complete stay gated to `inFlight` since they
      only make sense once a visit is actually underway.
- [x] **Pricing wording.** Flat-advance services now read "Advance ₹2,000 (monthly)" — on the mobile
      Services screen cards, the Appointment screen's service dropdown, and its order summary ("Monthly
      advance payment") — instead of the terser "₹2,000 advance" / "Flat advance payment". Reflects that
      Nutrition/Physio are billed as a recurring monthly amount, not a one-off.
- [x] **Renamed the single Services-screen action** from "Book Appointment" to "Request Appointment" —
      a booking actually lands as `requested` pending admin approval, not confirmed on tap, so the label
      now matches what happens. Same button, same position (bottom of the list), same selected-service
      behavior — wording only.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (15 routes); `mobile` `tsc --noEmit` clean +
  `expo export --platform web` bundle clean.

## Change round — "Request for Booking" quick-contact lead (user, 2026-07-29)
User clarified via a follow-up question: notification of a new request should be **in-app, admin-panel
only** (pull-based, matching the R3.4 precedent of no push/email/SMS alerts) — not a real Twilio SMS to
the admin's phone. New feature, new migration.

- [x] **New `booking_requests` table** (`supabase/migrations/0010_booking_requests.sql`, mirrored into
      `install_all.sql`). Deliberately separate from `bookings` — no service, date, or payment; just
      `account_id` (server-stamped from `auth.uid()` via a `BEFORE INSERT` trigger, same pattern as
      `report_uploads.uploaded_by` — never client-supplied), an optional `note`, and a
      `contacted`/`contacted_by`/`contacted_at` trail. RLS: insert own only; select own row or
      `is_admin()`; a `mark_request_contacted()` RPC (admin-only, mirrors `review_report()`) is the only
      write path for the contacted fields — no direct UPDATE grant.
- [x] **Shared layer**: `BookingRequest`/`BookingRequestWithAccount` types, `qk.bookingRequests`,
      `useBookingRequests(enabled)` (joins `profiles!booking_requests_account_id_fkey` for name/phone),
      `useCreateBookingRequest()`, `useMarkRequestContacted()`.
- [x] **Mobile — `ServicesScreen`**: new "Request for Booking" outline button *above* "Book Appointment"
      (reverted from last round's "Request Appointment" rename now that there are genuinely two distinct
      actions) — fires the insert directly with no service/date picker, toast confirms. "Book
      Appointment" is unchanged: still the full select-a-service-then-book flow.
- [x] **Web — new `/requests` admin page** (`web/src/components/AdminShell.tsx` nav gained "Requests"
      with a red unread-count badge sourced from the same `useBookingRequests` hook; `RequireStaff`-gated
      like every other page, not further admin-restricted since no other admin-only page in this codebase
      is either — nav-hiding + RLS is the established pattern). Lists open requests (name, phone,
      tap-to-call, "Mark contacted") with a collapsed "Contacted" section below.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (16 routes, new `/requests`); `mobile`
  `tsc --noEmit` clean + `expo export --platform web` bundle clean.
- **Needs the user's machine, same as every prior migration:** `0010_booking_requests.sql` (or the
  refreshed `install_all.sql`) has not run against the live Supabase project from this environment.

## Change round — booking flow no longer requires pre-selection, profile completion ring, friendlier errors (user, 2026-07-29)
User hit the still-outstanding `0010` migration gap live (screenshot: "Could not find the table
'public.booking_requests'") — confirmed to them again this is a pending-migration issue, not a code bug.
Alongside that, three UX asks:

- [x] **"Book Appointment" no longer requires selecting a service card first.** `mobile/src/screens/ServicesScreen.tsx`'s
      `book()` dropped its "choose a service first" toast guard — it now always navigates to Appointment
      with `serviceId: selected ?? undefined`, and `AppointmentScreen` already falls back to the first
      service when none is passed. Tapping a card still highlights it and pre-fills the picker; it's just
      no longer mandatory. (This reverses the "select first, then Book" behavior confirmed two rounds
      ago — the user's latest instruction explicitly asked for booking to open "without clicking the
      service" first.)
- [x] **Profile completion ring, Naukri-style.** New `ProfileCompletionButton` (inline in `ServicesScreen.tsx`,
      built on `react-native-svg` — already a transitive dependency via `lucide-react-native`, so no new
      package) sits next to the hospital call button in the header: a circular progress ring (grey track,
      brand-teal progress arc) with the percentage as center text, tap-through to the Profile tab.
      Percentage = how many of `full_name`/`age`/`date_of_birth`/`gender` are filled in — the same 4
      fields `ProfileScreen`'s "Your details" edit form covers, so the two never disagree.
- [x] **Booking-request errors no longer leak raw DB text to customers.** `useCreateBookingRequest`'s
      `onError` (`shared/src/mutations.ts`) now always shows a generic "Could not send your request.
      Please try again shortly." instead of `e.message` — a schema-cache error like the one above meant
      nothing to a customer trying to book care. (Every other mutation in this file still surfaces
      `e.message` directly; this one's the exception because its errors are almost always infra-side,
      never something the customer did wrong.)
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean (SVG ring resolved
  fine); `web` `tsc`/`eslint` clean (shares the edited mutation).
- **Still outstanding:** `0010_booking_requests.sql` / refreshed `install_all.sql` not yet run — the
  screenshot's error will keep appearing (now with friendlier wording) until it is.

## Change round — flat-advance services collect months, not days (user, 2026-07-29)
`num_days` was previously hidden entirely for Nutrition/Physio (forced to `1` on submit) — the user
asked for a duration field back, but in **months**, and confirmed the total must stay the flat advance
amount regardless of what's entered (no `months × price` multiplication, same as it was never
`days × price` for these two).

- [x] **`mobile/src/screens/AppointmentScreen.tsx`** — the day-count `FormInput` is no longer hidden for
      flat-advance services; it's relabeled "Number of months" (vs "Number of days" for per-day services)
      and feeds the same `form.num_days`/DB column — no schema change, since `bookings.num_days` is just
      an integer and the web live-sheet's "Days/Months" column already anticipated exactly this dual
      meaning. The `effectiveDays = isFlatAdvance ? 1 : days` clamp from two rounds ago is gone; whatever
      the customer enters is now genuinely persisted (previously always saved as `1`, discarding it).
      Total calculation is unchanged — `isFlatAdvance` already ignored `days` when pricing, so unhiding
      the field required no pricing-logic change, only removing the clamp and relabeling. The summary
      panel now reads "Advance payment · N months" with a small "Flat ₹X advance — not multiplied by
      months" note directly underneath, so the flat-vs-multiplied distinction is explicit on screen.
- [x] **`mobile/src/screens/PaymentScreen.tsx`** — the summary's "Days" row now reads "Months" for
      flat-advance bookings.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — vc.pdf: missed/reschedule + Checkup history, no-select Services, immutable profile + address (user, 2026-07-30)
Source: `vc.pdf`. New migration (`0011_profile_address.sql`), touches shared types/schemas/mutations, three
mobile screens, and the web patient self-edit form.

- [x] **Missed appointments + Reschedule, Checkup history in Health record.** New `isBookingMissed(status,
      startDate)` (`shared/src/format.ts`) — client-side read on a non-terminal booking whose `start_date`
      has already passed (the pipeline itself has no "missed" state). `mobile/src/screens/DashboardScreen.tsx`
      now splits into an "upcoming" list (not terminal, not missed) and a "Missed" section (red card, "You
      missed it" pill, **Reschedule** button) — the old single "Last appointment" footer is gone entirely.
      Reschedule uses nested tab navigation (`navigation.navigate("ServicesTab", { screen: "Appointment",
      params: { serviceId } })`) — required widening `AppTabsParamList.ServicesTab` from `undefined` to
      `NavigatorScreenParams<ServicesStackParamList> | undefined` (`navigation/types.ts`), plus a new
      `AppTabScreenProps<T>` helper so `DashboardScreen` (previously prop-less) can receive `navigation`.
      Past checkups (completed, cancelled, *or* missed) for the selected subject now live in a new
      "Checkup history" list inside `ProfileScreen`'s Health record card, sorted newest first — this is
      where finished visits are found now, not the Appointments tab.
- [x] **Services screen has no selection step at all.** Removed the tap-to-select card state entirely
      (`ServicesScreen.tsx` — no more `selected`/`CheckCircle2`/highlighted border); it's a pure browse
      list now. "Book Appointment" always navigates to the Appointment screen with no `serviceId`, which
      already defaults to the first service — the Service dropdown there is the only place a service is
      actually chosen. Pricing wording: "Advance ₹2,000 **(monthly package)**" (was "(monthly)").
- [x] **Mobile profile is read-only after registration.** Removed `ProfileScreen`'s entire edit branch
      (`editing` state, `startEdit`/`saveBio`, the bio `FormInput`/`DateField`/`ChoiceChips` form) — "Your
      details" is now always the plain read-only rows, with a note that corrections go through VAgeWell
      staff (i.e. the web admin panel's existing patient-edit form), not a self-service edit here.
      `useUpdateProfile` itself is untouched (still used by the web `MemberEditForm`).
- [x] **New `address` field.** `profiles.address text` (migration `0011`, mirrored into `install_all.sql`
      — `handle_new_user()` now also reads `raw_user_meta_data->>'address'`). Captured on
      `RegisterScreen` (new Address field, sent through OTP signup metadata same as age/gender, backfilled
      post-verify same as the others), shown as a read-only row in `ProfileScreen`, and editable from the
      web admin's `MemberEditForm` (self subject only — dependents have no `address` column) via a new
      optional `address` field on `useUpdateProfile`'s payload.
- [x] **Vitals now show "as of" a date.** `ProfileScreen`'s `VitalsView` reads whichever of the Sugar/Blood
      Group source records is more recent and prints "As of <date>" underneath the tiles — vitals values
      were already the latest-non-null-per-field, but had no date shown at all before.
- **Not changed:** Age is — and was already — optional everywhere it appears (`optionalAge` in
  `shared/src/schemas.ts`, no `required` prop on either Age `FormInput`); found no spot in the code where
  it was actually mandatory, so nothing needed fixing there.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (16 routes); `mobile` `tsc --noEmit` clean +
  `expo export --platform web` bundle clean.
- **Needs the user's machine, same as every prior migration:** `0011_profile_address.sql` (or refreshed
  `install_all.sql`) has not run against the live Supabase project from this environment. The pricing
  data issue from the previous round (Physio Therapy still reading ₹1,500/day) is a separate, already-
  flagged problem in the same category — still unresolved as of this round.

## Change round — only the most recent missed appointment surfaces on Dashboard (user, 2026-07-30)
User clarified the missed-appointments section from the previous round: don't list *every* missed
booking on the Appointments tab — just the latest one, as a nudge — while the full history (all missed,
completed, cancelled) keeps living in the Profile's Checkup list.

- [x] `mobile/src/screens/DashboardScreen.tsx`'s `missed` array (rendered as a full list) replaced with
      `recentMissed` — a single booking, the one with the latest `start_date` among missed bookings.
      Section heading changed to "Recently missed" to match. `ProfileScreen`'s Checkup history was
      already unfiltered by recency, so it needed no change — it already stores everything.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.
- **Still outstanding, unrelated to this round:** the Nutrition/Physio pricing display depends entirely
  on `services.pricing_model`/`price_per_day` in the live database — this has been diagnosed multiple
  times now (see prior rounds) and is not a code issue; the fix SQL has been provided but its effect
  hasn't yet been confirmed via the verification query requested earlier.

## Change round — "missed" now checks time, not just date (user, 2026-07-30)
`isBookingMissed()` previously compared `start_date` alone against today, so a same-day booking was
never "missed" until the calendar day fully rolled over — a 9 AM slot sat as merely "upcoming" all the
way until midnight even though the visit clearly didn't happen.

- [x] **`shared/src/format.ts`** — `isBookingMissed(status, startDate, timeSlot)` now takes the time slot
      too and compares the full scheduled `Date` (start_date + time_slot combined) against `Date.now()`,
      not just the date string against `todayISODate()`. All three call sites
      (`DashboardScreen.tsx` ×2, `ProfileScreen.tsx` ×2) updated to pass `b.time_slot`.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.
- **Still outstanding, unrelated to this round:** Nutrition/Physio pricing and the `booking_requests`
  table both still depend on the live database migration, still not confirmed as applied.

## Change round — Reschedule clears the missed booking it replaces (user, 2026-07-30)
Tapping Reschedule opened a fresh Appointment form but left the original missed booking exactly as it
was — so it kept sitting in "Recently missed" even after a new one was booked for the same service.

- [x] **`mobile/src/screens/DashboardScreen.tsx`'s `reschedule()`** now cancels the missed booking first
      (via `useCancelBooking`) when its `booking_status` is still `requested` or `approved` — the only
      statuses a patient is allowed to self-cancel (server-enforced by `tg_booking_update_guard`).
      A missed booking further along the pipeline (`assigned`, `in_progress`, …) is left alone rather
      than firing a cancel the trigger would reject anyway — that one needs staff to close out. Then
      navigates to the Appointment screen exactly as before.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — stale My Appointments after booking, "Last checkup completed" footer back (user, 2026-07-30)
Two follow-ups: booking a new appointment didn't show up immediately on My Appointments, and the old
"last completed checkup" summary (removed when Checkup history moved into the Profile screen) was wanted
back on the Dashboard too.

- [x] **`mobile/src/screens/PaymentScreen.tsx`'s booking insert never invalidated any query cache** — it
      writes straight via `supabase.from("bookings").insert(...)` (not a shared mutation hook, since
      server-authored fields like `total_amount` only exist after the trigger runs), so `useMyBookings()`
      kept serving up to 60s of stale data (its configured `staleTime`) after a fresh booking, a payment
      proof upload, or a reschedule. Added `qc.invalidateQueries({ queryKey: qk.bookings("mine") })` right
      after both the booking insert and the payment-proof update succeed.
- [x] **"Last checkup completed" footer restored on `DashboardScreen`.** A new `lastCompleted` (most
      recent `booking_status === 'completed'`, independent of the "Recently missed" section — both can
      show at once) renders via a read-only `LastCompletedCheckup` card in the `FlatList`'s footer. This
      doesn't duplicate the Profile's full Checkup history — it's just an at-a-glance pointer to the
      latest one, restoring what the pre-vc.pdf `LastAppointment` component used to do.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — belt-and-braces on stale data + missed dismissal (user, 2026-07-30)
User reported the previous round's fixes still weren't reliable enough — asked to "change it clearly."
Rather than re-diagnose the same cache-timing question, made both behaviors deterministic instead of
depending on invalidation timing or a server permission outcome.

- [x] **`DashboardScreen` now refetches on every focus**, via `useFocusEffect` (`@react-navigation/native`)
      calling `refetch()` from `useMyBookings()`. Booking, uploading a payment proof, and rescheduling all
      happen on a *different* screen/tab, so relying solely on `invalidateQueries` fired from elsewhere
      left a window where this tab wouldn't notice. Refetching on focus means the tab is always correct
      the moment it's actually looked at, regardless of what happened on another screen or when.
- [x] **"Recently missed" now clears unconditionally the instant Reschedule is tapped** — a new locally-
      persisted dismissed-IDs set (`AsyncStorage`, key `vagewell.dismissedMissedBookingIds`) is checked
      alongside the existing cancel attempt, not instead of it. Previously, clearing the banner depended
      on the server cancel actually succeeding (only true for `requested`/`approved` bookings) — a missed
      booking already `assigned` or further along would cancel-attempt silently and then keep reappearing
      forever, since nothing else ever removed it from view. Now the nudge disappears on this device the
      moment the user acts on it, independent of whatever state the underlying booking is actually left
      in server-side (staff still see and handle the real row via the web portal as before).
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — dismiss on actual booking, not on tapping Reschedule (user, 2026-07-30)
User corrected the previous round: dismissing "Recently missed" the moment Reschedule is *tapped* was
too early — the customer might open the form and back out without booking anything, and the old missed
booking would incorrectly vanish forever. It should only clear once the replacement is actually booked.

- [x] **Dismissal logic moved from `DashboardScreen` to `PaymentScreen`.** `reschedule()` on the Dashboard
      now only navigates (`{ serviceId, rescheduleOf: b.id }` — new `rescheduleOf` param on
      `ServicesStackParamList.Appointment`); it no longer cancels or dismisses anything itself.
      `AppointmentScreen` threads `route.params.rescheduleOf` into a new `BookingDraft.reschedule_of`
      field. `PaymentScreen.confirm()` — only once its own booking insert has actually succeeded — cancels
      the old booking (best-effort; a no-op if it's already past requested/approved) and calls the new
      `dismissMissedBooking()` helper.
- [x] **New `mobile/src/lib/dismissedMissed.ts`** — extracted the `AsyncStorage`-backed dismissed-IDs
      logic (previously inline in `DashboardScreen`) into shared `loadDismissedMissedIds()` /
      `dismissMissedBooking()` functions, since both `DashboardScreen` (reads, to filter) and
      `PaymentScreen` (writes, on success) need it now.
- [x] **`DashboardScreen`'s `useFocusEffect` also reloads dismissed IDs**, not just refetches bookings —
      the actual dismissal now happens on a different screen (Payment), so this tab needs to notice it
      whenever it's returned to.
- Clarified for the user, not a code change: the **Cancel** button already exists on every booking card
  (`PatientBookingCard.tsx`) — it only shows while `booking_status` is `requested` or `approved`, the
  same server-enforced window a patient can act in. Once staff assigns/starts a visit, only staff can
  cancel it from the web portal.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — surface Clinic Visit / Home Care to the customer (user, 2026-07-30)
User asked how a customer is supposed to know which mode (Clinic Visit vs Home Care) admin picked when
approving their booking — `bookings.service_mode` existed server-side (set on approval) but nothing in
the mobile app ever displayed it back to the patient.

- [x] **New `ServiceModeBadge`** (small indigo pill, `Building2`/`Home` icon + `SERVICE_MODE_LABELS`
      text) shown once `booking.service_mode` is set — i.e. from `approved` onward, since that's the
      admin action that decides it. Wired into `mobile/src/components/feature/PatientBookingCard.tsx`
      (every active booking) and `mobile/src/screens/DashboardScreen.tsx`'s `MissedAppointment` /
      `LastCompletedCheckup` summary cards, so it's visible everywhere a booking shows up. While a
      booking is still `requested` (mode not decided yet), `PatientBookingCard` shows a small "Clinic or
      home visit — decided once approved" hint instead, so the absence doesn't read as a bug.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — customer picks Clinic Visit or Home Care at booking time (user, 2026-07-30)
Reframes the previous round's badge: instead of just *displaying* whatever admin later decides, the
customer now picks the visit type themselves on the Appointment screen, same as any other booking field
— admin's job becomes assigning a matching staff/leaf_node member, not choosing the mode.

- [x] **DB (migration `0012_customer_chosen_service_mode.sql`, mirrored into `install_all.sql`).**
      `tg_booking_snapshot()` (the `BEFORE INSERT` trigger) previously hard-set `new.service_mode := null`
      unconditionally — now it validates the client-supplied value (`raise exception 'choose a visit type
      (clinic or home care)'` if missing/invalid) and leaves it as given. Also had to widen the column-
      level `grant insert (...)` on `bookings` to include `service_mode` — patients literally could not
      write that column before, regardless of RLS, since the grant list never named it.
- [x] **Shared**: `appointmentSchema` (`shared/src/schemas.ts`) gained a required `service_mode` enum
      field.
- [x] **Mobile `AppointmentScreen.tsx`**: new "Visit type" `ChoiceChips` (Clinic Visit / Home Care,
      default Clinic) between "Care for" and the date/duration row; threaded through `BookingDraft`
      (`navigation/types.ts` gained `service_mode: ServiceMode`) into `PaymentScreen`, whose insert
      payload now includes it — the booking summary there also gained a "Visit type" row so the customer
      sees their own choice before confirming.
- [x] **Web `ApproveAssignModal.tsx` no longer lets admin pick the mode** — it reads `booking.service_mode`
      (now already set by the customer) and shows it as a read-only "(chosen by customer)" line, filtering
      assignable staff/leaf_node candidates off that value directly. The old mode dropdown only reappears
      as a fallback for a booking created *before* this change, where `service_mode` is still `null` —
      `useAssignBooking`'s existing optional `serviceMode` param is only sent in that legacy case, so a
      customer's real choice is never silently overwritten.
- [x] **Pricing wording** — "Advance ₹2,000 (monthly package)" → "Advance ₹2,000 **(Monthly Followup)**"
      on `ServicesScreen.tsx`'s cards and `AppointmentScreen.tsx`'s service dropdown, matching the exact
      phrase requested. The summary panel's "not multiplied by months" note was already accurate and
      unchanged.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (16 routes); `mobile` `tsc --noEmit` clean +
  `expo export --platform web` bundle clean.
- **Needs the user's machine, same as every prior migration:** `0012_customer_chosen_service_mode.sql`
  (or refreshed `install_all.sql`) has not run against the live Supabase project from this environment —
  until it does, a customer picking a visit type will hit the new "choose a visit type" server error on
  submit, since the column-level insert grant doesn't exist there yet either.

## Bugfix — install_all.sql aborted partway through on every re-run (user, 2026-07-30)
**Root cause of essentially every "nothing changed" / stale-pricing / missing-table report across this
entire project.** User finally pasted the actual SQL Editor error: `ERROR: 42501: illegal
booking_status transition` from `tg_booking_update_guard()`, thrown *while running the migration script
itself* — not from the app.

The script's legacy-data backfill (`update bookings set booking_status = 'requested' where
booking_status = 'open'`, the 0009-era `open`/`closed` → new-pipeline conversion) is an `UPDATE` on
`public.bookings`. The very first time the script ran, `tg_bookings_before_update` didn't exist yet, so
this succeeded fine. But `install_all.sql` is explicitly meant to be re-run repeatedly ("idempotent, safe
to re-run") — and on every run *after* the first, that trigger already exists, fires on this UPDATE, and
`tg_booking_update_guard()` has no rule permitting a bare `'open'` → `'requested'` transition (only the
seven pipeline states know each other), so it hits the catch-all `raise exception 'illegal
booking_status transition'` and the **entire script aborts right there** — meaning every single change
positioned after it in the file (the full 0009–0012 feature set, the services reseed, the
`booking_requests` table, all of it) silently never ran, on every attempt. This is exactly consistent
with everything reported over the last several rounds: stale Physio Therapy pricing (the reseed is near
the end of the script), the missing `booking_requests` table (created even later), etc. — all downstream
of the script dying at this one line, every time.

- [x] **Fixed in both `supabase/migrations/0009_platform_expansion.sql` and `supabase/install_all.sql`.**
      Two changes: (1) the status `CHECK` constraint is now widened *before* the legacy-value backfill
      runs (previously backwards — on a truly fresh pre-0009 table the old constraint would have rejected
      `'requested'`/`'completed'` outright, a second latent bug); (2) the backfill is now wrapped in a
      trigger-existence check that disables `tg_bookings_before_update` immediately before the two
      `UPDATE`s and re-enables it immediately after — using `pg_trigger` existence checks (not a bare
      `ALTER TABLE ... DISABLE TRIGGER`, which errors if the trigger doesn't exist yet on a genuinely
      fresh install) so it's correct on both a first-ever run and every subsequent re-run.
- **Action for the user:** re-run the now-fixed `install_all.sql` in the Supabase SQL Editor — this
  should finally get all the way through and actually create `booking_requests`, fix the services
  pricing, and apply everything else that's been silently skipped every time before.

## Bugfix #2 — the trigger-guard fix above had its own chicken-and-egg bug (user, 2026-07-30)
User re-ran the fixed script and hit a *new* error: `23514: check constraint
"bookings_booking_status_check" of relation "bookings" is violated by some row`. The previous fix
widened the constraint before the legacy-value backfill specifically to avoid the *old* constraint
rejecting the *new* values — but that meant the constraint-widening `ALTER TABLE ... ADD CONSTRAINT`
itself now validated all existing rows against the new 7-value set immediately, and any row still
sitting on `'open'`/`'closed'` (which the backfill hadn't run yet at that point) violated it outright.
Textbook chicken-and-egg: neither ordering works with a plain `ADD CONSTRAINT`.

- [x] **Fixed in both files** by adding the constraint as `not valid` first — enforced for every write
  from that point forward, but skips the initial full-table validation scan of existing rows — then
  running the trigger-guarded backfill exactly as before, then `alter table ... validate constraint
  bookings_booking_status_check` at the end to confirm the whole table is now clean. This is the
  standard Postgres pattern for widening a constraint across a data migration and has no ordering
  conflict either way.
- **Action for the user:** re-run `install_all.sql` again — this should now finally complete end to end.

## Change round — Reschedule clears "Recently missed" on tap, not on booking completion (user, 2026-07-30)
User reversed the earlier "only dismiss once the replacement is actually booked" decision: tapping
Reschedule should empty the "Recently missed" space immediately.

- [x] **`mobile/src/screens/DashboardScreen.tsx`'s `reschedule()`** now calls `dismissMissedBooking()`
      (and updates local state) the moment Reschedule is tapped, then navigates — same as the very first
      version of this feature, before the mid-conversation correction. `PaymentScreen.tsx`'s own dismiss
      call on successful booking is left in place too (idempotent no-op at that point) since the actual
      server-side cancel of the old booking still only happens once a replacement is genuinely created —
      only the local "hide the nudge" behavior moved earlier.
- **Trade-off, stated plainly:** if the customer taps Reschedule and then backs out of the Appointment
  form without completing a new booking, the missed one will no longer reappear in "Recently missed" on
  this device (though it's untouched server-side, and still visible in the Profile's Checkup history).
  This is the explicit trade-off of the current request; flag if that turns out to be unwanted.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — Reschedule now actually cancels the missed booking server-side (user, 2026-07-30)
User reported the previous round's fix still didn't work: rescheduled and booked a replacement, but the
original missed booking kept showing in "Recently missed." The local-only `AsyncStorage` dismiss depends
on that exact device still having that exact persisted flag on every subsequent load — fragile across
reloads, and impossible to verify from this environment. Made it work unconditionally by actually
cancelling the old booking on the server the moment Reschedule is tapped, not waiting on anything else.

- [x] **`DashboardScreen.tsx`'s `reschedule()`** now calls `useCancelBooking().mutate(b.id)` immediately
      when the booking is still `requested`/`approved` (the only statuses a patient can self-cancel,
      server-enforced) — this permanently removes it from every future "missed" computation on every
      device, since a `cancelled` booking is terminal. The local dismiss (`dismissMissedBooking`) still
      also fires as a belt-and-braces for a missed booking already past that stage (`assigned`+), which a
      patient can't cancel themselves — that one is left for staff to close out via the web portal, but at
      least stops nagging this device.
- [x] **Removed the now-dead `reschedule_of`/`rescheduleOf` threading entirely** — since the cancel no
      longer waits for a replacement booking to exist, there's nothing left for `PaymentScreen` to do with
      it. Removed from `BookingDraft` (`navigation/types.ts`), `ServicesStackParamList.Appointment`'s
      params, `AppointmentScreen`'s draft construction, and `PaymentScreen`'s insert handler (which no
      longer imports `dismissMissedBooking` at all).
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Bugfix — new bookings could be "missed" the instant they're created (user, 2026-07-30)
Good news buried in the bug report: the previous round's fix actually worked — the original missed
Nutrition booking (Maheshwari S, 06:00 AM) genuinely disappeared from "Recently missed" after Reschedule
was tapped and a replacement booked. But a **different** Nutrition booking (a dependent, 07:00 AM, same
date) immediately took its place as "missed" — a brand-new booking, showing up already missed.

Root cause: `AppointmentScreen`'s form defaults to `start_date: todayISODate()` and
`time_slot: SLOTS[0].value` (the earliest slot, 06:00). The date picker (`DateField`) only blocks
picking a date *before* today — it says nothing about the time slot. If the customer submits without
changing the date/time away from those defaults (very easy to do on a Reschedule, where the flow already
feels "done" once you've picked a service), and the current time of day is already past whatever slot is
selected, the booking is created already in the past — `isBookingMissed()` correctly flags it as missed
the moment it exists, since it genuinely is.

- [x] **`AppointmentScreen.tsx`'s `submit()`** now checks, when `start_date` equals today, whether the
      chosen `time_slot` is still later than the current clock time — if not, blocks submission with
      "That time has already passed today — pick a later time or a future date" (same
      `errors`/`FormInput`-style validation pattern already used for the other fields), instead of
      silently creating an already-missed booking.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — dismiss "Recently missed" without rescheduling (user, 2026-07-30)
The prior screenshot confirmed the cancel-on-reschedule fix genuinely worked (a *different* stale test
booking took the missed one's place, unrelated). New ask: a way to clear the "Recently missed" nudge
when the customer simply doesn't want to reschedule that visit at all — not every missed booking should
force a reschedule.

- [x] **New "✕" button on `MissedAppointment`** (`DashboardScreen.tsx`), top-right of the card, next to
      the total. Calls a new `dismissOnly(b)` — local dismiss only (`dismissMissedBooking` +
      `dismissedMissed` state), no server-side cancel. The underlying booking is left exactly as it is;
      staff still see and can act on the real row via the web portal. This is deliberately different from
      `reschedule()`, which does attempt an actual cancel — dismissing isn't the same as saying "this
      never happened," just "stop showing me this."
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.

## Change round — self-service registration on the web staff portal (user, 2026-07-31)
User asked how a brand-new staff/leaf_node hire is supposed to get into the web portal, since `/login`
was login-only (`shouldCreateUser: false`) — there was no way in without already having an account.
Given a choice between just pointing new hires at the mobile app to register vs. letting a brand-new
number register directly on the web portal, the user chose the latter.

- [x] **New `web/src/app/register/page.tsx`.** Phone+OTP self-registration mirroring the mobile app's
      `RegisterScreen` two-step (details → OTP) pattern, but trimmed to just Full Name + Mobile Number —
      the other patient-only fields (age/gender/how_heard/wellness_note) don't apply to an ops account.
      `signInWithOtp({ shouldCreateUser: true, data: { full_name } })` lets a genuinely new number create
      an account here (unlike `/login`'s `shouldCreateUser: false`); `handle_new_user()` is unchanged and
      unaware of which app called it, so the new profile lands exactly like any mobile signup.
- [x] **Self-registered accounts always land as plain `role='patient'`, never an elevated role** —
      deliberately preserving the project's existing "no self-service elevated access" principle (staff/
      leaf_node/admin has always required an admin promotion via the role dropdown, never a self-pick).
      After OTP verification the page signs the session back out immediately (a patient-role session has
      nothing to do in this portal, and `RequireStaff` would bounce it on the next load anyway) and shows
      a "Account created — ask an admin to grant you access" message instead of attempting any redirect.
- [x] **`web/src/app/login/page.tsx`** gained a "New to VAgeWell? Register" link to the new page, mirroring
      the mobile Login screen's "New to VAgeWell? Create an account" link to Register.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes, new `/register`). No DB
  migration — reuses `handle_new_user()` and the existing role-promotion flow as-is.

## Change round — self-registration now grants the picked role immediately (user, 2026-07-31)
User rejected the "lands as patient, needs admin approval" design from the previous round: the Register
page should show the same role picker as `/login` and grant that role the moment OTP verifies — no
approval step. Asked directly which of three trade-offs to accept (immediate self-assign of Staff/Leaf
Node only, immediate self-assign of all three including Admin, or picker-as-request-only keeping the
approval step); user explicitly chose **immediate self-assign, all three roles including Admin**, having
been told plainly that this means anyone who can complete an OTP verification can make themselves an
admin.

- [x] **New migration `0013_self_select_role.sql`** (mirrored into `install_all.sql`, header bumped to
      "Combines migrations 0001–0013"). `handle_new_user()` now reads `requested_role` from the signup's
      `raw_user_meta_data` — if it's one of `staff`/`admin`/`leaf_node` the new profile is created with
      that role directly; anything else (including absent, the mobile Register screen's case) still
      defaults to `patient`, unchanged from before. This only ever runs on account **creation** — the
      trigger fires once per new `auth.users` row, so an already-existing account has no way to call this
      path again later to escalate itself; only a fresh signup can land with an elevated role this way.
- [x] **`web/src/app/register/page.tsx`** gained the same "Registering as" Staff/Admin/Leaf Node picker
      as `/login` (`OPS_ROLES`/`ROLE_LABELS`), sends the pick as `requested_role` in the signup metadata,
      and — since the account now already has the right role the instant OTP verifies — routes straight
      into the portal (`/dashboard` for Admin, `/my-visits` for Staff/Leaf Node) instead of signing out
      to a "wait for approval" screen.
- **Accepted, stated risk (not a bug):** `requested_role` is read from client-supplied signup metadata,
  so this isn't confined to the web UI's picker — any brand-new signup that includes
  `requested_role: 'admin'` in its metadata lands as admin immediately, whether it comes through this
  page, a hand-crafted call to the Supabase Auth API, or in principle the mobile app's own signup call
  (its `RegisterScreen` never sends this field today, so ordinary patient signups are unaffected in
  practice, but nothing at the database layer distinguishes "came from the web register page" from any
  other caller). This is the direct, explicit consequence of the "immediate, all three roles" choice
  above, not an oversight — flagging it here in case a future hardening pass is wanted (e.g. requiring an
  invite code, or restricting self-assignable roles to Staff/Leaf Node only and keeping Admin
  promotion-only).
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes). **Needs the user's machine,
  same as every prior migration:** `0013_self_select_role.sql` (or the refreshed `install_all.sql`) has
  not run against the live Supabase project from this environment — until it does, a new signup's
  `requested_role` is silently ignored and every new account still lands as `patient`, same as before.

## Bugfix — Register silently trusted the picked role instead of confirming it (user, 2026-07-31)
User tried registering `+919000000002` as Staff and landed on `/verify`'s "registered as Patient, not
Staff" mismatch screen — confusing, since that error message belongs to the *Login* flow, not Register.
Root cause: `web/src/app/register/page.tsx`'s `verify()` never actually checked what role the account
landed with — it just trusted the client-side `role` state the user had picked and redirected blindly
into `/dashboard` or `/my-visits`, where `RequireStaff` would then bounce a mismatched account back to
`/login` with no explanation of why. Two independent things can cause a mismatch, and this fix surfaces
either one directly on the Register page instead of failing silently three steps later:
1. **`0013_self_select_role.sql` genuinely hasn't run yet** against this Supabase project — the *only*
   outstanding migration action, unchanged from the previous round. `handle_new_user()` is still the
   pre-0013 version there, ignores `requested_role` entirely, and every new signup still lands `patient`.
2. **The phone number already had an account.** `handle_new_user()` only ever fires once, on the very
   first `auth.users` insert for that number — this is inherent to the design (see 0013's own comment:
   "only a fresh signup can set a role this way"). `+919000000002` is one of `config.toml`'s test-OTP
   numbers and had very likely already signed up during earlier testing in this project, so re-registering
   it can never change its role no matter what's picked or whether 0013 has run.
- [x] **`verify()` now re-fetches `profiles.role` after `verifyOtp` and compares it to the picked role**
  (same check `/verify`'s Login flow already does) before redirecting anywhere. A match proceeds exactly
  as before. A mismatch signs the session back out and shows a clear, actionable message on the Register
  page itself: *"This number already has an account (registered as X). Role selection only applies the
  first time a number signs up — ask an admin to change an existing account's role, or register with a
  different number."* — instead of quietly landing on `/verify`'s unrelated error copy.
- [x] **Stopped overwriting `full_name` on a mismatch.** The pre-fix code ran its `full_name` backfill
  unconditionally; moved it to only run once a role match confirms this really is a fresh registration —
  a failed attempt on someone else's existing number must not silently rename their account.
- **For the user, right now:** to test the feature itself, either (a) confirm `install_all.sql` /
  `0013_self_select_role.sql` has actually been run in the Supabase SQL Editor, **and** (b) use a phone
  number that has genuinely never signed up before (not `9000000002`/`9000000003`/etc. if they were used
  in earlier testing rounds) — check with
  `select id, phone, role, created_at from profiles where phone = '+91XXXXXXXXXX';` in the SQL Editor
  first. To fix an already-existing test account directly: `update profiles set role = 'staff' where
  phone = '+919000000002';` (swap the role/number as needed) — a manual promotion, same mechanism the
  admin role dropdown itself performs.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes).

## Bugfix — portal hung on an infinite "Loading…" after OTP with no error shown (user, 2026-07-31)
After promoting `+919000000002`/`+919000000003` via the SQL above and logging in through `/login`, the
portal got stuck on a blank "Loading…" screen indefinitely — no error, no redirect, nothing. `web/.env.local`
confirmed the app targets the real hosted project (`ccvpwfzqgrrhxrmzlkca.supabase.co`), so this wasn't a
local-vs-hosted mismatch.

Root cause, found by reading `AuthProvider.loadProfile()`: `supabase.from("profiles").select("*")...
.maybeSingle()` **does not throw on a database-level error** — the Supabase JS client resolves it as
`{ data: null, error }` instead. The old code only destructured `data`, never checked `error`, so any
failed profile fetch (permission hiccup, transient network blip, anything) looked byte-for-byte identical
to one still in flight: `profile` just stayed `null` forever. `RequireStaff`'s render guard
(`loading || !user || !profileResolved || !isOpsRole(role)`) can't tell "still loading" apart from
"failed and never will," so it rendered the same spinner in both cases, forever, with the actual failure
reason discarded and never shown anywhere — the exact symptom reported, and impossible to diagnose further
from outside the browser's own DevTools.

- [x] **`AuthProvider.tsx`**: `loadProfile()` now checks the returned `error` (and treats a genuinely
      empty result — `data` null with no error — as its own error too, since `handle_new_user()` should
      always have created a row) and stores it in new state `profileError`, exposed on the auth context.
      Wrapped in try/catch as well, so a thrown network exception is captured the same way instead of
      propagating.
- [x] **`RequireStaff.tsx`** now renders an explicit error card — the message plus **Try again**
      (`refreshProfile()`) and **Sign out** buttons — the moment `profileError` is set and nothing is still
      in flight, instead of falling through to the generic spinner. Whatever is actually wrong is now
      visible on screen instead of requiring a DevTools Network-tab investigation.
- **Not diagnosed further here** (no way to inspect the user's live browser/network from this
  environment) — this fix turns the next occurrence into a readable error message instead of a silent
  hang, which is what's needed to actually identify the underlying cause (paused project, RLS drift,
  transient network issue, or something else) next time it happens.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes).

## Bugfix — the actual cause: a race between verifyOtp() and a follow-up getUser() call (user, 2026-07-31)
The error-surfacing fix above did its job — it turned the silent hang into a readable message: Register,
re-tested against `+919000000002`, now showed **"Could not confirm your account's role. Please try
again."** instead of hanging. That pointed straight at the real bug: `actualRole` was coming back `null`,
meaning the `profiles` select matched **zero rows** — for an account that unquestionably exists.

Root cause: `register/page.tsx`'s `verify()` (and `verify/page.tsx`'s identical pattern) called
`supabase.auth.verifyOtp(...)`, threw away its response, then made a **separate** `supabase.auth.getUser()`
call right after to get the just-verified user. That second call is racy — if it executes before the new
session has fully settled on the client, it can return no user, so the follow-up
`.eq("id", user?.id ?? "")` profile lookup runs with an empty string and matches nothing. `verifyOtp()`
already returns the authenticated user directly in its own response (`data.user`) — there was never a
reason to ask again.

- [x] **`web/src/app/register/page.tsx`** and **`web/src/app/verify/page.tsx`**: both now read
      `verifyData.user` from `verifyOtp()`'s own return value instead of a follow-up `getUser()` call —
      removes the race entirely, one fewer network round-trip too.
- [x] **Register's error messages sharpened further**: the profile-select's `error` is now checked
      explicitly (`Could not confirm your account: <db error>`) rather than only handling "zero rows";
      a genuinely missing user object after a successful verify gets its own explicit message too,
      instead of silently coercing to `""` and producing the same generic "could not confirm" text
      regardless of which of the (now three) distinct failure modes actually occurred.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes).

## Bugfix — Staff / Leaf Nodes admin pages had no way to promote anyone (user, 2026-07-31)
User asked how to promote `9000000002`/`9000000003` from the admin UI instead of hand-running SQL each
time, and reported no add/promote option existed on the `/staff` or `/leaf-nodes` pages. Confirmed by
reading `web/src/components/OpsMemberList.tsx` (shared by both pages): its list is filtered to
`p.role === role` **unconditionally** — i.e. it only ever shows people who *already* hold that role — and
its empty state read "Promote a registered account below to see it here," which was simply untrue: there
was no such control anywhere on the page. The only real promote control in the whole app lives on
`/patients/[accountId]`'s Role dropdown, reachable only by finding the account under **Patients** first
(which itself only lists `role === 'patient'` accounts) — nothing on `/staff`/`/leaf-nodes` said so.

- [x] **`OpsMemberList.tsx`**: typing into the search box now widens the pool from "current holders of
      this role" to **every account**, so an existing patient (or any other role) can be found by name or
      phone directly on the Staff/Leaf Nodes page and promoted with the same inline role dropdown that was
      already there for existing members — no query, and the list still narrows to just that role, same as
      before. Placeholder text and both empty-state variants (no query vs. no match) rewritten to describe
      what's actually possible, instead of pointing at a nonexistent control.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes). No DB change — this only
  changes what the existing `useAllProfiles`/`useSetUserRole` data is filtered to show.

## Data fix — baked the two test-account role promotions into `install_all.sql` (user, 2026-07-31)
`+919000000002` then started showing "No profile record was found for this account" — a step further
broken than the earlier "registered as Patient" mismatch, meaning its `profiles` row was gone entirely
(most likely deleted directly at some point without also deleting the `auth.users` row, or an earlier
manual `update ... where phone = '+91...'` silently matched nothing — `auth.users.phone` is stored
**without** the leading `+`, so a filter that includes it never matches). User asked for the fix to live
in `install_all.sql` itself rather than a one-off snippet, so re-running the script they already run
repeatedly takes care of it.

- [x] **`supabase/install_all.sql`**, right after the existing commented-out founding-admin promotion
      block: an active (not commented) `insert ... on conflict do update` for both test numbers —
      `9000000002 → staff`, `9000000003 → leaf_node`. `insert ... on conflict` rather than a plain
      `update` specifically so it repairs the account even when its `profiles` row is missing outright,
      not just when it exists with the wrong role; `replace(phone, '+', '')` matches regardless of the
      `+` prefix. Idempotent — safe on every re-run, matching this file's existing convention (see the
      founding-admin block right above it, same pattern). Meant to be deleted once these two numbers are
      no longer needed for testing.
- **Action for the user:** re-run `install_all.sql` in the Supabase SQL Editor; both accounts should read
  the correct role afterward regardless of whatever broken state they were left in.

## Change round — "View Report" action on My Visits (user, 2026-07-31)
Staff/leaf_node's `/my-visits` card showed "Report uploaded: <date>" once a report existed for that
booking, but gave no way to actually open it — the only place that could was the admin's `/reports` page.

- [x] **`web/src/app/my-visits/page.tsx`**: `VisitCard` gained a **View Report** action (shown whenever
      `latestReport` exists, alongside Vitals/Upload Report/Complete) that creates a signed URL for the
      report's `storage_path` (`MEDICAL_REPORT_BUCKET`, `SIGNED_URL_TTL_SECONDS` — the exact same call the
      admin `/reports` page already uses) and opens it in a new tab. Fetched on click, not eagerly per
      card, to avoid a storage API call for every visible visit regardless of whether anyone looks.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes).

## Change round — full report history for every ops role, with patient name & date (user, 2026-07-31)
User's follow-up: the admin `/reports` page only ever showed reports still awaiting review (once
released, they vanished — no audit trail), it was admin-only in the nav (staff/leaf_node had no access at
all), and there was no reliable "who is this for" — clarified via a follow-up question that **all three
ops roles** need to see the full report history (with patient name and upload date), while the mobile
app's patient-facing view stays exactly as-is (reviewed reports only, unchanged).

The real blocker to doing this simply: `report_select` RLS already grants any `is_staff()` caller
(staff/leaf_node/admin) every report regardless of whose booking it's on, but `bk_select` scopes plain
staff/leaf_node to only their **own assigned** bookings. So a client-side join against `bookings` to
resolve "which patient/service is this report for" would silently come up empty for any report outside
that staff member's own assigned scope — visible, but unlabeled. Fixed at the source: snapshot the name
onto the report row itself at upload time, the same pattern already used everywhere else in this schema
(`bookings.service_name`/`price_per_day`, etc.).

- [x] **New migration `0014_report_uploads_snapshot.sql`** (mirrored into `install_all.sql`, header
      bumped to "0001–0014"): `report_uploads` gains `patient_name`/`service_name` columns, populated by
      `tg_report_uploaded_stamp()` (the existing `BEFORE INSERT` trigger, now also looking up the parent
      booking's service and subject — family member or account — at write time) plus a repair-path
      backfill for rows that predate this column.
- [x] **`shared/src/types.ts`**: `ReportUpload` gains the two new fields. **`shared/src/hooks.ts`**: new
      `useAllReports(enabled)` — every report, reviewed or not, no bookings join needed at all now.
      **`shared/src/mutations.ts`**: `useUploadReport`/`useReviewReport` invalidate the new `qk.reportsAll`
      key too, alongside what they already invalidated.
- [x] **`web/src/app/reports/page.tsx`** rewritten: title "Reports" (was "Reports awaiting review"), lists
      *everything* via `useAllReports`, each card shows `service_name · patient_name` directly (no join,
      no lookup-miss risk), a search box (name or service), and a Released/Awaiting-review pill. **View**
      (signed URL, opens in a new tab) is available to everyone; **Release** only renders for
      `role === 'admin'` on an unreleased row — matches what `review_report()` already enforces
      server-side, just not exposed as an action to roles that would only get a 403 from it.
- [x] **`web/src/components/AdminShell.tsx`**: added "Reports" to `OPS_NAV`, so staff/leaf_node can reach
      the page at all — it was in `ADMIN_NAV` only before, with no way in for the other two roles even
      though RLS always permitted it.
- **Not touched, by explicit instruction:** the mobile app's report visibility (`useMyReports`, the
  patient Health record) — patients still only ever see `reviewed = true` rows for their own household,
  unchanged; this round is entirely about the staff-side view.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes); `mobile` `tsc --noEmit` clean +
  `expo export --platform web` bundle clean (2823 modules — confirms the shared `ReportUpload` type
  change didn't break the mobile side, which also consumes it).
- **Needs the user's machine, same as every prior migration:** `0014_report_uploads_snapshot.sql` (or the
  refreshed `install_all.sql`) has not run against the live Supabase project from this environment — until
  it does, `patient_name`/`service_name` will read `null` on both new and existing report rows.

## Change round — Reports as a real table, filename capture, popup-blocker fix (user, 2026-07-31)
Follow-up: the card layout wasn't the tabular columns asked for (date / patient name / report name), and
"clicking did nothing" on the previous round's My Visits **View Report** button — root-caused as a classic
popup-blocker trap: that button's `onClick` called `window.open()` **after an `await`** (fetching the
signed URL first), and by the time the promise resolved, the browser no longer considers it a direct user
gesture — most browsers silently swallow the call, no error, no console warning, just nothing happening.

- [x] **New migration `0015_report_file_name.sql`** (mirrored into `install_all.sql`, header bumped to
      "0001–0015"): `report_uploads.file_name` — the original uploaded filename was never captured before
      (`storage_path` is a generated `<booking_id>/<uploaded_by>/<timestamp>.<ext>`, not the source name),
      so there was nothing readable to show as "which file is this" beyond the report type category.
      `ReportUploadModal.tsx` now passes `file.name` through `useUploadReport`'s new `fileName` param into
      the insert.
- [x] **`web/src/app/reports/page.tsx` rewritten as an actual `<table>`**: Uploaded (date) / Patient
      (name + service) / Report (file name + type + note) / Status / Actions columns, sorted newest first,
      same search box and View/Release actions as before.
- [x] **Popup-blocker fix, both pages**: replaced every "click handler awaits a signed URL, then
      `window.open()`" pattern with prefetching signed URLs up front (`useQuery`, keyed off the visible
      report(s)) and rendering a real `<a href target="_blank">` once the URL resolves — a genuine link
      click is never blocked, regardless of the async fetch that produced its `href`. Fixed in both
      `web/src/app/reports/page.tsx` (already used this pattern for its list, unaffected) and
      `web/src/app/my-visits/page.tsx`'s `VisitCard` (the actual bug — its View Report button used the
      broken pattern), which also now shows the report's filename alongside its upload date.
- **Confirmed, not changed:** who can upload/release was already correctly locked down — `report_uploads`
  has no `update` grant at all (only the admin-only `review_report()` RPC can touch `reviewed`/`reviewed_by`/
  `reviewed_at`, via `security definer`), and `report_insert` RLS already requires `is_staff()`. A patient
  has no reachable path to upload or edit a report today; nothing needed fixing there.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes); `mobile` `tsc --noEmit` clean +
  `expo export --platform web` bundle clean.
- **Needs the user's machine:** `0015_report_file_name.sql` (or the refreshed `install_all.sql`), on top of
  the still-outstanding `0014` from the previous round — until both run, the Report column falls back to
  just the report-type label (no filename) and patient/service names stay blank.

## Follow-up — confirmed the table rewrite is live; mobile Health record shows filenames too (user, 2026-07-31)
User repeated the same "no changes happen" report verbatim. Re-checked: the `/reports` table rewrite and
the My Visits popup-blocker fix from the previous round (`c4b8bf7`) are confirmed committed and pushed —
`git log`/`git diff` show no regression and a clean working tree. Most likely explanation on the user's
side is a stale dev server / browser cache, or (if testing a deployed URL rather than `npm run dev`) that
URL hasn't been redeployed with the latest commit — neither of those is something fixable from this
environment. The user also asked, separately, for reports to show in the mobile app's Profile Health
record — that already existed (added in the 2026-07-29 "reports in health record" round); enhanced it
slightly to match this round's web-side improvement.

- [x] **`mobile/src/screens/ProfileScreen.tsx`**: the Health record's Reports list now shows
      `file_name` (falling back to the report-type label for older rows without one, same as the web
      table) as the primary line, with type + upload date underneath — was previously just the type label
      with no way to tell two same-type reports apart.
- Verified: `mobile` `tsc --noEmit` clean + `expo export --platform web` bundle clean.
- **For the user:** to confirm the web-side fix is actually live, hard-refresh (Ctrl+Shift+R) the
  `/reports` and `/my-visits` pages, and if you're testing a deployed URL rather than a local `npm run dev`,
  make sure that deployment has picked up the latest `main` (commit `c4b8bf7` or later).

## Change round — Report link on Live Sheet; found & fixed the real "report not showing" bug (user, 2026-07-31)
Two follow-ups. First, a request clarified through back-and-forth: rather than only a separate `/reports`
page, each patient's row in the Live Sheet should carry its own report link directly. Second, the user
reported reports still not appearing in the patient's mobile Health record even after confirming (via a
clarifying question) that clicking **Release** on `/reports` correctly flips the status pill — meaning the
gap was specifically on the read side, not the release action itself.

- [x] **`web/src/app/live-sheet/page.tsx`**: new "Report" column (both Overall and Updated views), built
      from `useAllReports()` grouped by `booking_id` (first match wins, since the hook is already sorted
      newest-first) and a batch `createSignedUrls()` call, rendered as a real `<a href target="_blank">`
      per row — never a click-handler `window.open()` after an await, the same popup-blocker class of bug
      fixed last round. Deliberately kept **out** of the exported columns/CSV (`OVERALL_COLUMNS`/
      `UPDATED_COLUMNS`/`visible` untouched) — a signed URL expires, so it isn't meaningful data to persist
      in a downloaded sheet, just a live on-screen convenience.
- [x] **Root cause of "released but the patient still doesn't see it": no refetch-on-focus on the mobile
      Health record.** Confirmed via a targeted diagnostic exchange (ruled out: same-file-uploaded-twice
      data artifact; ruled out: the Release action itself). React Query caches are per-device — when an
      admin clicks Release in their own browser, `useReviewReport`'s `invalidateQueries` only clears *that*
      browser's cache. A patient's already-open mobile app is a completely separate process with its own
      cache and has no way to know anything changed server-side; nothing was ever asking it to check again.
      This is the exact same class of bug already fixed once for `DashboardScreen`'s bookings
      ("belt-and-braces on stale data", 2026-07-30) — `ProfileScreen.tsx` just never got the same
      treatment. Fixed: `ProfileScreen` now calls `useFocusEffect` to refetch reports, bookings, and vitals
      every time the Profile tab regains focus, so returning to it always reflects the current server
      state regardless of what changed elsewhere or when.
- **Also clarified for the user, not a bug:** a report only ever shows under the *subject* (self or a
  specific dependent) whose booking it belongs to — checking "Myself" won't show a dependent's released
  report; the correct name must be picked from "View record for" first.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes); `mobile` `tsc --noEmit` clean +
  `expo export --platform web` bundle clean.

## Change round — staff/leaf_node search sees every patient; Report column shows every upload (user, 2026-07-31)
User asked for a consolidated view when searching a patient on the Live Sheet, clarified via two direct
questions into two explicit decisions: (1) staff/leaf_node should be able to search and see **any**
patient's history on the Live Sheet, not just visits assigned to them; (2) the Report column should list
**every** report ever uploaded for a booking, not just the newest one.

- [x] **New migration `0016_staff_see_all_bookings.sql`** (mirrored into `install_all.sql`, header bumped
      to "0001–0016"): widened `bk_select` RLS from `in_household(account_id) or is_admin() or
      (is_staff() and assigned_to = auth.uid())` to `in_household(account_id) or is_staff()` — bringing
      bookings in line with the precedent every other clinically-relevant policy already set
      (`clin_select`/`report_select`/`fam_select`/`svc_select` all already grant any `is_staff()` caller
      full visibility; bookings was the one outlier still scoped to assignment). **Deliberately did not
      touch `bk_update`** — seeing a booking and being allowed to act on it (start/complete/upload) stay
      different questions; only the assigned member or admin can still do the latter. `useMyAssignedBookings`
      (web My Visits) is unaffected either way — it already filters explicitly to `assigned_to = auth.uid()`
      on the client on top of RLS, so widening the SELECT policy doesn't change what that page shows.
- [x] **`web/src/app/live-sheet/page.tsx`**: the Report column now groups `useAllReports()` by
      `booking_id` into a full list (was: first-match-only via a `Map<string, string>`) and renders every
      report for that visit as its own small `View` link (label = filename, falling back to the report-type
      label), stacked in the cell — a booking with a prescription *and* a separate image now shows both,
      where before only the most recently uploaded one was reachable from this page at all.
- Verified: `web` `tsc`/`eslint`/`next build --webpack` clean (17 routes). No shared/mobile changes this
  round. **Needs the user's machine, same as every prior migration:** `0016_staff_see_all_bookings.sql`
  (or the refreshed `install_all.sql`) has not run against the live Supabase project from this
  environment — until it does, a staff/leaf_node account's Live Sheet search still only surfaces their
  own assigned bookings.

