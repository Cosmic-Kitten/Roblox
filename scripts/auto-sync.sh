#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current)"
if [ -z "$branch" ]; then
  echo "No git branch detected."
  exit 1
fi

# Ensure the repo is clean enough to commit without hanging on prompts.
git add -A

if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

commit_message="auto-sync: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

git commit -m "$commit_message"
git pull --rebase origin "$branch"
git push origin "$branch"

echo "Auto-sync complete on $branch"
