#!/usr/bin/env bash
set -euo pipefail

BASELINE="${TSC_BASELINE_ERROR_COUNT:-12}"
LOG="$(mktemp)"

if ! command -v npx >/dev/null 2>&1; then
  echo "check-typecheck-baseline: required command 'npx' not found in PATH" >&2
  exit 1
fi

if ! command -v grep >/dev/null 2>&1; then
  echo "check-typecheck-baseline: required command 'grep' not found in PATH" >&2
  exit 1
fi

strip_ansi() {
  sed 's/\x1b\[[0-9;]*m//g'
}

run_tsc() {
  if [ -n "${CHECK_TYPECHECK_TSC_INVOKE:-}" ]; then
    bash -c "${CHECK_TYPECHECK_TSC_INVOKE}"
  else
    npx tsc --noEmit -p tsconfig.typecheck.json --pretty true
  fi
}

# Must match local: npx tsc --noEmit -p tsconfig.typecheck.json --pretty true
TSC_EXIT=0
run_tsc >"$LOG" 2>&1 || TSC_EXIT=$?
PLAIN_LOG="$(mktemp)"
trap 'rm -f "$LOG" "$PLAIN_LOG"' EXIT
strip_ansi <"$LOG" >"$PLAIN_LOG"

if [ ! -s "$LOG" ] && [ "$TSC_EXIT" -ne 0 ]; then
  echo "check-typecheck-baseline: tsc failed (exit $TSC_EXIT) but produced no output" >&2
  exit 1
fi

COUNT="$(grep -c 'error TS' "$PLAIN_LOG" 2>/dev/null || true)"
if ! [[ "${COUNT:-}" =~ ^[0-9]+$ ]]; then
  echo "check-typecheck-baseline: could not parse TypeScript error count from tsc output" >&2
  cat "$LOG" >&2
  exit 1
fi

if [ "$TSC_EXIT" -ne 0 ] && [ "$COUNT" -eq 0 ]; then
  echo "check-typecheck-baseline: tsc exited $TSC_EXIT but no 'error TS' lines were counted" >&2
  cat "$LOG" >&2
  exit 1
fi

if [ "$TSC_EXIT" -ne 0 ]; then
  if [ "$TSC_EXIT" -ge 128 ]; then
    echo "check-typecheck-baseline: tsc exited with abnormal signal/code $TSC_EXIT" >&2
    cat "$LOG" >&2
    exit 1
  fi
  if ! grep -qE 'Found [0-9]+ error' "$PLAIN_LOG"; then
    echo "check-typecheck-baseline: tsc exited $TSC_EXIT without a 'Found N error(s)' summary (possible crash)" >&2
    cat "$LOG" >&2
    exit 1
  fi
fi

if [ "$COUNT" -gt "$BASELINE" ]; then
  echo "TypeScript error count $COUNT exceeds baseline $BASELINE"
  cat "$LOG"
  exit 1
fi

echo "TypeScript check OK ($COUNT errors, baseline $BASELINE)"
