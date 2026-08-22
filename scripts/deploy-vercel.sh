#!/usr/bin/env bash
# Builds the mobile app's web export and deploys it to the "vagewell-web-deploy"
# Vercel project (separate from the old, unrelated "web" project already linked
# at the repo root — see CLAUDE.md's 2026-08-22 "first Vercel deploy" round for
# why that link is deliberately not reused).
#
# Works around a real Vercel CLI behavior: it silently excludes any folder
# literally named `node_modules` from the upload, and Expo's web export
# happens to name a real asset folder `assets/node_modules/@expo-google-fonts/...`
# (mirroring the font package's own path). Left alone, the fonts 404 and the
# app renders a blank page forever (useFonts() never resolves). This script
# renames that folder and patches the one JS bundle file that references it
# before deploying, every time.
#
# Run from the repo root: bash scripts/deploy-vercel.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Building web export..."
(cd mobile && npx expo export --platform web)

DEPLOY_DIR="$(mktemp -d)"
echo "==> Staging a deploy copy outside the repo (avoids the root .vercel link)..."
cp -r mobile/dist/. "$DEPLOY_DIR/"

# Explicitly link to the known "vagewell-web-deploy" project by ID, rather
# than relying on Vercel's directory-name-based project matching — mktemp
# gives each run a differently-named temp dir, which would otherwise create a
# new project every time instead of updating this one.
mkdir -p "$DEPLOY_DIR/.vercel"
cat > "$DEPLOY_DIR/.vercel/project.json" <<'JSON'
{"projectId":"prj_DTYvXANLfN1IW9slum9wBksr8x8E","orgId":"team_luWGHoDmzXqF8SiIywfhdIO5","projectName":"vagewell-web-deploy"}
JSON

if [ -d "$DEPLOY_DIR/assets/node_modules" ]; then
  echo "==> Working around Vercel's node_modules upload exclusion..."
  mv "$DEPLOY_DIR/assets/node_modules" "$DEPLOY_DIR/assets/vendor-fonts"
  grep -rl "assets/node_modules" "$DEPLOY_DIR" | while read -r f; do
    sed -i 's#assets/node_modules#assets/vendor-fonts#g' "$f"
  done
fi

echo "==> Deploying to Vercel (project: vagewell-web-deploy)..."
(cd "$DEPLOY_DIR" && npx --yes vercel deploy --prod --yes)

rm -rf "$DEPLOY_DIR"
echo "==> Done. Live at: https://vagewell-web-deploy.vercel.app"
