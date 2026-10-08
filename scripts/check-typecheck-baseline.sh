#!/usr/bin/env bash
set -euo pipefail

BASELINE="${TSC_BASELINE_ERROR_COUNT:-13}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

npx tsc --noEmit -p tsconfig.typecheck.json >"$LOG" 2>&1 || true
COUNT="$(rg -c 'error TS' "$LOG" || true)"
COUNT="${COUNT:-0}"

if [ "$COUNT" -gt "$BASELINE" ]; then
  echo "TypeScript error count $COUNT exceeds baseline $BASELINE"
  cat "$LOG"
  exit 1
fi

echo "TypeScript check OK ($COUNT errors, baseline $BASELINE)"
