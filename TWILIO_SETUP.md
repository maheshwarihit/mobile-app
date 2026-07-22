# Twilio SMS OTP — Setup Guide

VAgeWell logs everyone in with **phone + 6-digit SMS OTP** via **Supabase Auth**. In local dev you don't
need Twilio at all — fixed test codes in `supabase/config.toml` let you log in offline. To send **real
SMS** (staging/production), wire Supabase Auth to Twilio as below.

> Twilio credentials are **server-side only** (they live in Supabase, never in the mobile app). The app
> only ever holds `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

---

## 0. Dev shortcut (no Twilio needed)

`supabase/config.toml` already defines fixed test numbers:

```toml
[auth.sms.test_otp]
"+919000000001" = "123456"
"+919000000002" = "123456"
"+919000000009" = "123456"
```

Log in locally with `+919000000001` / code `123456`. Keep these for development even after Twilio is
configured — any number **not** in this list gets a real SMS; test numbers stay offline.

---

## 1. Create a Twilio account & copy credentials

1. Sign up at <https://www.twilio.com/try-twilio> and verify your email + phone.
2. In the **Twilio Console** dashboard, copy:
   - **Account SID** — starts with `AC…`
   - **Auth Token** — click to reveal
3. **Trial accounts** can only send SMS to **verified** numbers and prepend a trial notice. Upgrade
   (add a payment method) to send to any number in production.

## 2. Create a sender — a Messaging Service (recommended)

1. Console → **Messaging → Services → Create Messaging Service**.
2. Add a **sender** to it: a Twilio phone number (SMS-capable) or an Alphanumeric Sender ID.
3. Copy the **Messaging Service SID** — starts with `MG…`.

*(Alternative: buy a single SMS-capable number under **Phone Numbers → Buy a number** and use that number
as the sender instead of a Messaging Service.)*

### 🇮🇳 India (DLT) note — important
Sending SMS to **Indian** numbers requires **DLT registration** (TRAI): register your business entity, a
**sender ID (header)**, and the **message template** text. The OTP body you send must exactly match a
registered template, e.g. `Your VAgeWell verification code is {{code}}`. Without DLT, delivery to Indian
numbers will fail. For quick testing, verify your own number on a Twilio trial or use **Twilio Verify**
(next section), which handles compliant delivery.

---

## 3A. Local stack (Supabase CLI + `config.toml`)

1. Enable Twilio in `supabase/config.toml`:
   ```toml
   [auth.sms.twilio]
   enabled = true                                        # was false
   account_sid = "env(TWILIO_ACCOUNT_SID)"
   message_service_sid = "env(TWILIO_MESSAGING_SERVICE_SID)"
   auth_token = "env(TWILIO_AUTH_TOKEN)"
   ```
2. Make the three variables available to the CLI **before** starting the stack — the CLI substitutes
   `env(…)` from your shell environment. Put them in a **git-ignored** file you source, or export them:
   ```bash
   export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   export TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   export TWILIO_AUTH_TOKEN=your_auth_token
   ```
   > Never commit these. `.env`, `.env.*`, and `*-credentials.json` are already git-ignored.
3. Restart the stack so Auth reloads the config (a `db reset` does **not** reload auth settings):
   ```bash
   supabase stop && supabase start
   ```
4. Keep the `[auth.sms.test_otp]` block so dev logins stay offline; real numbers now receive real SMS.

## 3B. Hosted Supabase project (Dashboard)

1. **Authentication → Providers → Phone** → enable the **Phone** provider.
2. **SMS provider → Twilio**, then enter:
   - Account SID (`AC…`)
   - Auth Token
   - Messaging Service SID (`MG…`) *(or your Twilio phone number)*
3. *(Optional, easiest for India/compliance)* choose **Twilio Verify** instead of raw Twilio:
   - Create a **Verify Service** in Twilio (Console → Verify → Services), copy its **Verify Service SID**
     (`VA…`).
   - In Supabase pick **Twilio Verify** and enter Account SID + Auth Token + Verify Service SID.
   - Verify generates/sends the OTP itself; length/expiry are set on the Verify service (keep **6 digits**).
4. **Authentication → Rate Limits**: set the per-hour SMS limit and OTP expiry as needed.
5. Save.

---

## 4. Keep the code length at 6

Supabase's SMS OTP (and Twilio Verify's default) is **6 digits**, matching the app's `OTP_LENGTH = 6`
(`shared/src/constants.ts`). Do **not** switch the app to 4 digits — the real code is 6 and a 4-box UI
would reject it.

## 5. Message template

Local template lives in `config.toml`:
```toml
[auth.sms]
template = "Your VAgeWell verification code is {{ .Code }}"
```
On hosted, set it under **Authentication → Templates → SMS** (skip if using Twilio Verify). For India,
the text must match your **DLT-registered** template exactly.

## 6. Founding admin (real-SMS path)

Self-registration only ever creates `role = 'patient'`. To create the first admin with real SMS:
1. Register in the app with a real number and complete the real OTP.
2. Promote it once — edit `supabase/seed.sql`'s founding-admin `UPDATE` (set the phone) and re-run
   `supabase db reset`, **or** run in Studio SQL:
   ```sql
   update public.profiles set role = 'admin'
    where id = (select id from auth.users where phone = '+91XXXXXXXXXX');
   ```
3. Thereafter, that admin promotes staff/admins in-app (Admin panel → Patients → Role).

## 7. Verify it works

Enter a **non-test** real number in the app → you should receive a 6-digit SMS → the code verifies and the
session opens. Admins entering via **🔒 Admin Portal** land on the admin dashboard; patients land on the
patient tabs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Error sending confirmation OTP` | Check Account SID / Auth Token; ensure the Messaging Service has a sender and the number is SMS-capable. |
| No SMS to an Indian number | Complete **DLT** registration (sender ID + template), or use Twilio Verify. |
| Trial: "not a verified number" | Verify the recipient in Twilio, or upgrade the account. |
| `429` / rate-limited | Raise the SMS rate limit under Supabase Auth → Rate Limits. |
| Local changes ignored | You must `supabase stop && supabase start`; `db reset` does not reload auth config. |
| Code rejected | Confirm the app is on **6** digits and you enabled the same provider that minted the code. |
