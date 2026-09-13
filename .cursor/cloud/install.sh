#!/usr/bin/env bash
# Cloud Agent install: refresh the toolchain and dependencies for slack-ai-agent.
# Idempotent: safe to run repeatedly and against cached state.
set -euo pipefail

# 1. mise (pinned toolchain manager). Install only if missing.
if ! command -v mise >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/mise" ]; then
  curl -fsSL https://mise.run | sh
fi
export PATH="$HOME/.local/bin:$PATH"

# 2. Install the versions pinned in mise.toml (node, pnpm, uv, gcloud, terraform, ...).
mise trust
mise install

# 3. System dependency: Redis. The worker connects at boot (REDIS_URL).
#    Docker is not required in the Cloud Agent; install the server package directly.
if ! command -v redis-server >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq redis-server
fi

# 4. Workspace dependencies (pnpm monorepo).
mise exec -- pnpm install --frozen-lockfile

# 5. Pre-warm tsx so the webhook terminal can boot offline.
#    server.ts uses NodeNext ".js" specifiers that resolve to ".ts"; native
#    `node --experimental-strip-types` does not remap those, so tsx runs it.
mise exec -- pnpm dlx tsx --version >/dev/null 2>&1 || true

# 6. Refresh the graphify knowledge graph (AGENTS.md 作業準備; AST-only, best-effort).
mise exec -- graphify update . >/dev/null 2>&1 || true
