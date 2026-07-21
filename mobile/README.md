# VAgeWell Care — Mobile (Android, Expo)

Native Android app (React Native + Expo). Reuses the web app's data layer via the
shared package **`@vagewell/shared`** (Supabase hooks, mutations, Zod schemas, types).

## Architecture note
`mobile/` is intentionally **self-contained** — it has its own complete `node_modules`
and is **not** part of the root npm workspace. Why: the web app runs React 19 (Next 16)
and Expo SDK 52 runs React 18.3, which conflict if hoisted into one tree. Mobile consumes
the shared code as a `file:../shared` dependency (`@vagewell/shared`), and Metro follows
the symlink. Everything (React, React Query, Supabase) resolves to a single instance from
`mobile/node_modules`, so there's no version skew.

## Prerequisites
- Node.js 20+
- An **Android phone** with the free **Expo Go** app (from the Play Store)
- The phone and this computer on the **same WiFi network**

## One-time setup
```bash
cd mobile
npm install                 # builds mobile/node_modules (self-contained)
# .env already exists with the Supabase URL + anon key (git-ignored).
# If versions ever drift after adding a package:
#   npx expo install --fix
```

## Run it (on your phone)
```bash
cd mobile
npx expo start              # a QR code appears in the terminal
```
Then open **Expo Go** on your Android phone and **scan the QR code**. The app loads over
WiFi. Edit any file and it hot-reloads instantly.

- If the phone can't reach the computer (different networks / firewall), run
  `npx expo start --tunnel` instead (routes over the internet; slightly slower).

## What works today (Phase 1)
- App boots to a themed Landing screen (NativeWind + Nunito Sans).
- Supabase client is wired (secure token storage, session persistence, auto-refresh).
- Navigation switches between signed-out and signed-in stacks automatically.
- The shared data layer (`@vagewell/shared`) is connected and bundles cleanly.

Login/registration screens, the design-system components, and the booking/dashboard/profile
screens are built in the following phases.

## Verify without a phone
```bash
npx tsc --noEmit                       # type-check
npx expo export --platform android     # full Metro bundle (proves it builds)
```

## Useful
- Env vars use the `EXPO_PUBLIC_*` convention (browser-safe, like the web's `NEXT_PUBLIC_*`).
- Styling: NativeWind (Tailwind classes on React Native components).
- Package manager: npm. Shared code lives in `../shared/src` (edit once, both apps update).
