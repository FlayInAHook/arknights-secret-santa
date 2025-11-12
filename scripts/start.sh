#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="arknights-secret-santa"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if screen -list | grep -qE "[.]${SESSION_NAME}\\b"; then
  echo "Screen session '$SESSION_NAME' is already running."
  exit 0
fi

# Launches the Bun dev server in a detached screen session so it keeps running after logout.
screen -dmS "$SESSION_NAME" bash -lc "bun run dev"
echo "Started screen session '$SESSION_NAME'."
