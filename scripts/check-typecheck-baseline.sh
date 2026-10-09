#!/usr/bin/env bash
set -euo pipefail

BASELINE="${TSC_BASELINE_ERROR_COUNT:-13}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

if ! command -v npx >/dev/null 2>&1; then
  echo "check-typecheck-baseline: required command 'npx' not found in PATH" >&2
  exit 1
fi

if ! command -v grep >/dev/null 2>&1; then
  echo "check-typecheck-baseline: required command 'grep' not found in PATH" >&2
  exit 1
fi

# Must match local: npx tsc --noEmit -p tsconfig.typecheck.json
TSC_EXIT=0
npx tsc --noEmit -p tsconfig.typecheck.json >"$LOG" 2>&1 || TSC_EXIT=$?

if [ ! -s "$LOG" ] && [ "$TSC_EXIT" -ne 0 ]; then
  echo "check-typecheck-baseline: tsc failed (exit $TSC_EXIT) but produced no output" >&2
  exit 1
fi

COUNT="$(grep -c 'error TS' "$LOG" 2>/dev/null || true)"
if ! [[ "${COUNT:-}" =~ ^[0-9]+$ ]]; then
  echo "check-typecheck-baseline: could not parse TypeScript error count from tsc output" >&2
  cat "$LOG" >&2
  exit 1
fi

if [ "$COUNT" -gt "$BASELINE" ]; then
  echo "TypeScript error count $COUNT exceeds baseline $BASELINE"
  cat "$LOG"
  exit 1
fi

echo "TypeScript check OK ($COUNT errors, baseline $BASELINE)"
