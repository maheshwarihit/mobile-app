#!/usr/bin/env bash
# Builds the mobile app's web export and deploys it to the "vagewell-care"
# Vercel project under the VilvaTech team (https://vagewell-care.vercel.app).
#
# This is the VilvaTech-owned twin of scripts/deploy-vercel.sh — same build and
# same node_modules workaround, just pinned to a different project/team. Use
# this one when you don't have credentials for the original "vagewell-web-deploy"
# project (a separate Vercel team). Requires: `vercel login` as a VilvaTech
# member, or VERCEL_TOKEN set to a VilvaTech token.
#
# The node_modules rename works around a real Vercel CLI behavior: it silently
# excludes any folder literally named `node_modules` from the upload, and Expo's
# web export names a real asset folder `assets/node_modules/@expo-google-fonts/...`.
# Left alone the fonts 404 and the app renders a blank page forever.
#
# Run from the repo root: bash scripts/deploy-vilvatech.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Building web export..."
(cd mobile && npx expo export --platform web)

DEPLOY_DIR="$(mktemp -d)"
echo "==> Staging a deploy copy outside the repo (avoids the root .vercel link)..."
cp -r mobile/dist/. "$DEPLOY_DIR/"

# Pin the exact project by ID so each run updates this one project instead of
# creating a new one named after the (random) temp dir.
mkdir -p "$DEPLOY_DIR/.vercel"
cat > "$DEPLOY_DIR/.vercel/project.json" <<'JSON'
{"projectId":"prj_2AQnJVAThtBrIR8TCeXEFwUbVrQ1","orgId":"team_B5sITwSzHgbC03Tyq79PADPB","projectName":"vagewell-care"}
JSON

if [ -d "$DEPLOY_DIR/assets/node_modules" ]; then
  echo "==> Working around Vercel's node_modules upload exclusion..."
  mv "$DEPLOY_DIR/assets/node_modules" "$DEPLOY_DIR/assets/vendor-fonts"
  grep -rl "assets/node_modules" "$DEPLOY_DIR" | while read -r f; do
    sed -i 's#assets/node_modules#assets/vendor-fonts#g' "$f"
  done
fi

echo "==> Deploying to Vercel (project: vilva-tech/vagewell-care)..."
(cd "$DEPLOY_DIR" && npx --yes vercel deploy --prod --yes --scope team_B5sITwSzHgbC03Tyq79PADPB)

# Best-effort — Git Bash on Windows sometimes keeps a transient lock on the
# temp dir right after the upload finishes; a leftover temp dir is harmless.
rm -rf "$DEPLOY_DIR" 2>/dev/null || true
echo "==> Done. Live at: https://vagewell-care.vercel.app"
