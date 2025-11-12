#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="arknights-secret-santa"

if ! screen -list | grep -qE "[.]${SESSION_NAME}\\b"; then
  echo "Screen session '$SESSION_NAME' is not running."
  exit 0
fi

# Gracefully terminates the detached screen session that runs the Bun dev server.
screen -S "$SESSION_NAME" -X quit
echo "Stopped screen session '$SESSION_NAME'."
