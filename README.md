# VAgeWell Care — Module 1

Home healthcare app for elderly patients and their families. A family signs in with their phone
number (OTP) or Google, adds family members, books home care visits, and uses wellness tools
(BMI, body metrics, Meal Scanner, self-assessment, Lab Report Insights). Care staff and admins use
the same app to assign visits, record vitals, upload reports and review payments.

- **Android app** (Google Play, package `in.vagewell.care`) and **web app** from one codebase.
- **No custom backend server.** The app talks directly to Supabase; a few Supabase Edge
  Functions handle AI and account deletion.
- **Languages:** English and Tamil.

**Live test site:** https://vagewell-web-deploy.vercel.app

---

## Tech stack

| Part | What we use |
|---|---|
| App | Expo SDK 54 · React Native 0.81 · React 19 · TypeScript |
| Styling | NativeWind (Tailwind classes on native components) |
| Navigation | React Navigation (bottom tabs + native stack) |
| Data fetching | TanStack Query (shared hooks in `shared/`) |
| Backend | Supabase — Auth (phone OTP + Google), Postgres with Row-Level Security, Storage, Edge Functions (Deno) |
| AI | Anthropic Claude, called only from Edge Functions (Meal Scanner, Lab Report Insights) |
| Web hosting | Vercel |
| Android builds | EAS Build (Expo's cloud build) |

## User roles

The role is stored in `profiles.role` and decides which screens a person sees
(`mobile/src/navigation/RootNavigator.tsx`).

| Role | Who | Main screens |
|---|---|---|
| `patient` | Families (the default) | Services, Appointments, Profile, Nutrition, Lab Report Insights |
| `leaf_node` | Care Givers (field staff) | My Visits, Clients, Profile |
| `admin` | Operations team | Appointments, Requests, Team, Reports, Payments, Live Sheet, User Details |

Staff accounts are created from the "Care Giver / Admin" door on the landing screen. The database
only grants a staff role when the sign-up name matches a fixed value (migrations 0038–0039).

---

## Project layout

```
mobile-app/
├── mobile/                  The Expo app (Android + web)
│   ├── App.tsx              Entry: providers + navigation
│   ├── app.json             App name, package id, versionCode, permissions
│   ├── eas.json             EAS build profiles (development / preview APK / production AAB)
│   ├── public/              Static web files: privacy-policy.html, terms.html, delete-account.html
│   └── src/
│       ├── screens/         One file per screen (ops/ = Care Giver + Admin screens)
│       ├── components/      ui/ (buttons, inputs, modals) · feature/ (patient features) · ops/ (staff)
│       ├── navigation/      Root, patient tabs, staff tabs, route types
│       ├── providers/       AuthProvider (session + profile)
│       ├── lib/             Helpers: supabase client, i18n, AI calls, storage, legal docs…
│       │   ├── i18n/translations/   All UI text, one file per area, English + Tamil
│       │   └── legal/               Terms of Service + Privacy Policy (JSON)
│       └── hooks/
├── shared/                  @vagewell/shared — types, constants, zod schemas, query hooks
├── supabase/
│   ├── migrations/          Database changes, numbered 0001, 0002… (run in order)
│   ├── functions/           Edge Functions: analyze-food-plate, analyze-lab-report, delete-account
│   ├── install_all.sql      One-paste setup for a new project (covers migrations 0001–0046)
│   ├── seed.sql             The 4 services
│   ├── wipe_all_data.sql    DANGER: deletes all accounts and data (manual, one-off)
│   └── config.toml          Local Supabase config (test OTP numbers)
├── scripts/
│   ├── deploy-vercel.sh     Build + deploy the web app to vagewell-web-deploy.vercel.app
│   ├── deploy-vilvatech.sh  Same, to the VilvaTech project (vagewell-care.vercel.app)
│   └── build-legal-pages.mjs Builds the public Terms/Privacy pages from the JSON
└── docs/
    ├── requirements.md      Client requirements (source of truth for behaviour)
    ├── workflow-draft.pdf   Original workflow diagram
    ├── twilio-sms-setup.md  Sending real OTP SMS through Twilio
    ├── dev-log.md           Detailed history of every change round (why things are the way they are)
    └── archive/             Old planning material
```

---

## Getting started

### 1. Prerequisites
- Node.js 20+ and npm (the repo uses npm; `mobile/.npmrc` sets `legacy-peer-deps=true`)
- An Android phone with **Expo Go**, or an Android emulator, or just a browser
- Access to the Supabase project (ask the project owner)

### 2. Install
```bash
git clone https://github.com/maheshwarihit/mobile-app.git
cd mobile-app/mobile
npm install          # also links ../shared as @vagewell/shared
```

### 3. Environment
Copy `mobile/.env.example` to `mobile/.env` and fill in:

| Variable | Where to find it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` public key (safe to expose; RLS protects data) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | The Web Client ID set in Supabase → Authentication → Providers → Google |

Never put the `service_role` key in the app. Production builds take these values from
`mobile/eas.json`.

### 4. Run
```bash
cd mobile
npx expo start        # scan the QR code with Expo Go, or press "a" for an emulator, "w" for web
npm run typecheck     # TypeScript check — run before every commit
```

**Test login without SMS:** in Supabase → Authentication → Providers → Phone → *Test phone
numbers*, add e.g. `919000000001=123456`. In the app, enter `9000000001` and code `123456`.

> Don't run `expo upgrade` or install `expo@latest` — it changes the SDK and breaks Expo Go.

---

## Database

- Every schema change is a new numbered file in `supabase/migrations/`. **Never edit an old
  migration** — add the next number. Make migrations safe to re-run (`if not exists`, `drop … if exists`).
- To apply: open the Supabase **SQL Editor**, paste the file and run it.
- **New project:** run `install_all.sql`, then migrations **0047 onwards** in order, then `seed.sql`.
- Security lives in the database: Row-Level Security policies, column grants and triggers decide
  who can read or change what. Check the latest migration that touches a table before changing it.
- Service names in the database stay as `Nutrition`, `Physio Therapy`, `Para-Medical`,
  `Mental Wellbeing`. The app shows them as Nutrition, Exercise, Bio Markers and Mind & Wellbeing
  (`mobile/src/lib/serviceI18n.ts`).

### Edge Functions
| Function | Purpose | Secrets |
|---|---|---|
| `analyze-food-plate` | Meal Scanner (photo → foods, calories, nutrients) | `ANTHROPIC_API_KEY` |
| `analyze-lab-report` | Lab Report Insights | `ANTHROPIC_API_KEY` |
| `delete-account` | Deletes the signed-in user's account and files | `SUPABASE_SERVICE_ROLE_KEY` (set automatically) |

Deploy with `supabase functions deploy <name>`; set secrets with `supabase secrets set KEY=value`.

---

## Text, translations and legal pages

- **All UI text** is in `mobile/src/lib/i18n/translations/`. Each file exports `en` and `ta`;
  TypeScript fails if a Tamil entry is missing, so always add both.
- **Health Disclaimer** (translated): `translations/disclaimer.ts`.
- **Terms of Service / Privacy Policy** (English): `mobile/src/lib/legal/terms.json` and
  `privacy.json`. The same JSON builds the public pages `privacy-policy.html` and `terms.html`
  (`node scripts/build-legal-pages.mjs`, run automatically by the deploy scripts). The Privacy
  Policy URL is the one entered in Google Play Console.

---

## Deploying

### Web
```bash
bash scripts/deploy-vercel.sh        # → https://vagewell-web-deploy.vercel.app
```
Needs the Vercel CLI logged in to the team that owns the project.

### Android (Google Play)
```bash
cd mobile
npx eas-cli build --platform android --profile production   # → .aab for Play Console
npx eas-cli build --platform android --profile preview      # → .apk for testing on a phone
```
- The production profile bumps `android.versionCode` in `app.json` automatically — commit that change.
- The signing key is stored on Expo (account `vagewellcare`). Always build from that account, or
  Google Play will reject the update.
- Upload the `.aab` in Play Console → Test and release.

---

## Conventions

- **Branch:** work on `main` for small changes; use a feature branch + pull request for bigger ones.
- **Before committing:** `npm run typecheck` in `mobile/` must pass.
- **Commits:** `type(scope): summary`, e.g. `feat(mobile): …`, `fix(db): …`, `chore(mobile): …`.
- **New text:** add an English + Tamil entry; never hard-code UI strings.
- **New table or column:** a migration with RLS policies and grants, then update `shared/src/types.ts`.
- **History:** `docs/dev-log.md` explains past decisions — search it before changing behaviour
  that looks odd; there is usually a reason.

## Open items

- Run migration `0055_ryles_tube_apostrophe.sql` on the live database (0054 can be skipped).
- Privacy Policy: add the registered company address and the SMS provider name.
