#!/bin/bash
# Jumbo Royale - Quick commit & push helper
# Usage:
#   ./scripts/push.sh "Your commit message"
#   GITHUB_TOKEN=ghp_xxx ./scripts/push.sh "Your commit message"
#
# Note: NEVER commit your token to git. Set it as an env var or paste when prompted.
# After pushing, GitHub may auto-revoke tokens that appear in commits/chats —
# always generate fresh tokens from https://github.com/settings/tokens

set -e
cd "$(dirname "$0")/.."

MSG="${1:-auto: update Jumbo Royale}"
REPO="Chandima-Prabhath/JUMBO-ROYALE"

# Stage all changes
git add -A

# Check if there's anything to commit
if git diff --cached --quiet; then
  echo "[push] Nothing to commit. Working tree clean."
  # Still try to push in case there are local commits not yet on remote
  git push "https://github.com/$REPO.git" main 2>/dev/null && echo "[push] Pushed existing commits." || echo "[push] No changes to push."
  exit 0
fi

# Commit
git commit -m "$MSG"

# Push using token if provided, otherwise normal push (will use credential helper)
if [ -n "$GITHUB_TOKEN" ]; then
  echo "[push] Pushing with GITHUB_TOKEN..."
  git push "https://Chandima-Prabhath:${GITHUB_TOKEN}@github.com/${REPO}.git" main
else
  echo "[push] Pushing (will use cached credentials or prompt)..."
  git push "https://github.com/${REPO}.git" main
fi

echo "[push] Done. View at: https://github.com/$REPO"
