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

