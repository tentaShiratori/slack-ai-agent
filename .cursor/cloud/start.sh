#!/usr/bin/env bash
# Cloud Agent start: bring up per-boot services (Redis) before the terminals launch.
# Idempotent: detects an already-running Redis and exits successfully.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

if ! redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
  # Ephemeral dev cache: no persistence, matches the docker-compose "redis" service.
  redis-server --bind 127.0.0.1 --port 6379 --daemonize yes --save "" --appendonly no
  for _ in $(seq 1 20); do
    if redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

# Fail the start phase loudly if Redis never became ready.
redis-cli -h 127.0.0.1 -p 6379 ping
