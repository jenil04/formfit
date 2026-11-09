#!/usr/bin/env bash
# Build (if needed) and serve Formfit in production mode on :4310.
# Secrets are sourced at runtime from outside the repo; none live in this file.
set -euo pipefail
cd "$(dirname "$0")/.."

export COREPACK_HOME="${COREPACK_HOME:-$HOME/.cache/corepack}"
export PORT="${PORT:-4310}"
export NODE_ENV=production
# Public demo: open straight into the shared demo workspace, no sign-up.
# (server/plugins/auth.ts resolves every request to one guest session.)

SECRETS_FILE="${FORMFIT_ENV_FILE:-/workspace/secrets/cto-anthropic.env}"
if [ -f "$SECRETS_FILE" ]; then
  set -a; . "$SECRETS_FILE"; set +a
fi

# Auth stays enabled in production, which requires a stable session secret.
# Generate one on first run and keep it beside the database (data/ is untracked).
mkdir -p data
if [ -z "${BETTER_AUTH_SECRET:-}" ]; then
  [ -f data/.auth-secret ] || { umask 077; openssl rand -hex 32 > data/.auth-secret; }
  BETTER_AUTH_SECRET="$(cat data/.auth-secret)"
  export BETTER_AUTH_SECRET
fi

# Rebuild when there is no build, or any source is newer than the built server.
BUILT=.output/server/index.mjs
if [ ! -f "$BUILT" ] || [ -n "$(find app server actions shared agent-native.config.ts package.json -type f -newer "$BUILT" 2>/dev/null | head -1)" ]; then
  pnpm build
fi

exec pnpm start
