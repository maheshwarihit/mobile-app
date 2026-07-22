# VAgeWell Care — Android app (React Native + Expo)

Native Android app built with **Expo SDK 54** (React Native 0.81, React 19).
It reuses the shared data layer in `../shared` (`@vagewell/shared`) and talks
directly to Supabase (phone-OTP auth, Postgres + RLS, Storage).

---

## Prerequisites
- **Node.js 20+** and npm
- An **Android phone** with the free **Expo Go** app (from the Play Store)
  — or an Android emulator (Android Studio)
- Phone and computer on the **same WiFi**

---

## 1. Install
```bash
git clone https://github.com/Aswithasankar/mobile-app.git
cd mobile-app/mobile
npm install
```
> `npm install` also links the shared code from `../shared` automatically.

## 2. Add environment values
The app needs two **public** Supabase values (safe to expose — protected by RLS).
Create a file **`mobile/.env`** (it is git-ignored, so it's not in the repo):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```
Copy the shape from `mobile/.env.example`. Get the values from the Supabase
dashboard → **Project Settings → API** (Project URL + `anon` public key).

## 3. Run it
```bash
npx expo start
```
A **QR code** appears. Open **Expo Go** on your Android phone → **Scan QR code**.
The app loads over WiFi and hot-reloads as you edit.

- Phone can't connect (different network / firewall)? → `npx expo start --tunnel`
- Using an emulator instead? → press **`a`** in the terminal

## 4. Log in (phone OTP)
Login uses Supabase Phone Auth. To test **without** paying for real SMS:

1. Supabase dashboard → **Authentication → Sign In / Providers → Phone**
2. Enable **Phone Sign-In**
3. Under **Test phone numbers**, add a pair **without the `+`**, e.g.
   `919000000001=123456`
4. In the app, enter the **10-digit** number (`9000000001` — the app adds `91`),
   tap **Send OTP**, then enter the code (`123456`)

For real users, connect **Twilio** under the same Phone provider screen.

> The Supabase project must also have the database loaded (run the migrations +
> `seed.sql` in `../supabase` on your project) so services, bookings, etc. exist.

---

## Handy commands
```bash
npx tsc --noEmit                     # type-check
npx expo export --platform android   # full offline bundle (proves it builds)
```

## Notes
- **Don't run** `expo upgrade` or `expo install expo@latest` — that jumps the SDK
  version and breaks compatibility with the installed Expo Go. Just `npx expo start`.
- Styling is **NativeWind** (Tailwind classes on native components).
- Package manager is **npm** (`.npmrc` sets `legacy-peer-deps=true`, needed for RN).

## Build for the Play Store (when ready)
```bash
npm install -g eas-cli
eas login
eas build --platform android      # cloud build → a Play-ready .aab (works on Windows)
eas submit --platform android
```
Needs a **Google Play Developer account** ($25 one-time) and an app icon/splash.
