#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="arknights-secret-santa"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/logs"
LOG_FILE="$LOG_DIR/server.log"
mkdir -p "$LOG_DIR"

BUN_CMD="${BUN_CMD:-}"
SCRIPT_NAME="${SCRIPT_NAME:-start}"
if [ -z "$BUN_CMD" ]; then
  if ! BUN_CMD="$(command -v bun 2>/dev/null)" || [ -z "$BUN_CMD" ]; then
    echo "Could not locate the 'bun' executable. Set BUN_CMD to its path before running this script." >&2
    exit 1;
  fi
fi

if screen -list | grep -qE "[.]${SESSION_NAME}\\b"; then
  echo "Screen session '$SESSION_NAME' is already running."
  exit 0
fi

# Launches the Bun server in a detached screen session while preserving PATH for Bun.
COMMAND=$(cat <<EOF
PATH="$PATH" "$BUN_CMD" run "$SCRIPT_NAME" |& tee -a "$LOG_FILE"
EOF
)

screen -dmS "$SESSION_NAME" bash -lc "$COMMAND"
echo "Started screen session '$SESSION_NAME' using 'bun run $SCRIPT_NAME'. Logging to $LOG_FILE"
