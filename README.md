# VAgeWell Care — Module 1

A mobile-first **PWA** for home-healthcare intake & verification. A patient (account holder)
registers via phone OTP, manages dependents, browses services, books multi-day care, and submits
a UPI payment proof. Staff/admin record vitals, clear payments, and export appointments.

**Stack:** Next.js 16 (App Router, React 19, TS) + Supabase (Auth · Postgres + RLS · Storage ·
Edge Functions). No separate backend service — the browser talks directly to Supabase; the only
server-side code is one Edge Function that emails the admin on booking finalization.

## Architecture at a glance
- **Auth:** Supabase phone + 6-digit SMS OTP, `auth.uid()`, 72-hour sessions.
- **Data:** 5 Postgres tables (`profiles`, `family_members`, `services`, `bookings`,
  `clinical_records`) protected by Row-Level Security + column GRANTs + `SECURITY DEFINER`
  triggers (server-authored pricing, no role self-escalation, patient-read-only vitals).
- **Storage:** private `payment-proofs` bucket (5 MB; png/jpg/webp).
- **Email alert:** `supabase/functions/notify-admin` fired by a DB webhook on booking finalize.
- **Excel export:** generated **client-side** in the admin dashboard.

## Prerequisites
- Node.js 20+ (tested on 22), npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) 2.7+
- Docker Desktop (for `supabase start` local stack)

## Setup

```bash
# 1. Start the local Supabase stack (Postgres, Auth, Storage, Studio, Inbucket)
supabase start

# 2. Apply schema + seed
supabase db reset          # runs supabase/migrations/* then supabase/seed.sql

# 3. Serve the email Edge Function (dev logs the email; no send)
supabase functions serve notify-admin --no-verify-jwt
#    Then wire the DB webhook so bookings trigger it: Studio → Database →
#    Webhooks → new hook on public.bookings (Insert+Update) → Edge Function
#    notify-admin.  (SQL equivalent: supabase/webhooks.sql)

# 4. Frontend
cd frontend
cp .env.local.example .env.local     # fill NEXT_PUBLIC_SUPABASE_URL / ANON_KEY from `supabase status`
npm install
npm run dev                          # http://localhost:3000
```

### Test login (no live SMS needed)
`supabase/config.toml` defines fixed OTP test numbers. Use phone **`+919000000001`** with code
**`123456`** to log in locally. Promote it to admin by editing `supabase/seed.sql`
(founding-admin block) and re-running `supabase db reset`.

## Roles
| Role | Can |
|---|---|
| `patient` | register, manage own profile + dependents, book care, upload payment proof, view own vitals |
| `staff` | everything a patient sees for **all** users + record/edit vitals |
| `admin` | staff powers + clear/reject payments, export appointments, change user roles |

## Project layout
```
shared/         TypeScript contract (types + constants) shared by app & edge fn
supabase/       migrations, seed, config, edge function
frontend/       Next.js PWA (src/app screens, src/components, src/lib)
```

## Verification
See the build plan's E2E section. Quick check: register a patient, book Physiotherapy for 3 days →
total should read **₹4500** (3 × ₹1500), matching the DB's generated `total_amount` column.
