# CLAUDE.md

Guidance for AI coding assistants working in this repo. Start with `README.md` (setup, layout,
deploy). Past decisions and the reasons behind them are in `docs/dev-log.md`. Search it before
changing behaviour that looks odd.

## Rules
- App code is in `mobile/` (Expo, React Native, TypeScript, NativeWind). Shared types/hooks are in `shared/`.
- Run `npm run typecheck` in `mobile/` after every change; it must pass.
- All UI text goes in `mobile/src/lib/i18n/translations/*.ts` with both `en` and `ta` entries.
- Database changes are a new numbered migration in `supabase/migrations/`. Never edit an old one,
  and make it safe to re-run. The user applies migrations by hand in the Supabase SQL Editor, so
  say clearly when one is pending.
- Service names in the DB (`Physio Therapy`, `Para-Medical`, `Mental Wellbeing`) differ from what
  the app shows (Exercise, Bio Markers, Mind & Wellbeing). Display text is in `lib/serviceI18n.ts`.
  Its description keys must match the DB text exactly.
- Terms/Privacy text is in `mobile/src/lib/legal/*.json`. The public pages are generated from it.
- Web deploy: `bash scripts/deploy-vercel.sh`. Android: `npx eas-cli build -p android --profile production`.
- After a notable change, add a short entry to the end of `docs/dev-log.md`.
