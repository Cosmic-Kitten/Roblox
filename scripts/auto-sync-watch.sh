#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "Watching for file changes in $repo_root"
echo "Press Ctrl+C to stop."

while true; do
  inotifywait \
    --quiet \
    --recursive \
    --event close_write,create,delete,moved_to \
    --exclude '(^|/)(\.git|node_modules)(/|$)' \
    . >/dev/null

  # Group rapid editor writes into one commit.
  sleep 2
  npm run auto-sync
  echo "Watching for the next change..."
done
