#!/bin/bash
# Jumbo Royale - Quick commit & push helper
# Usage: ./scripts/push.sh "Your commit message"
#
# If you have a GitHub token, set it as GITHUB_TOKEN env var or
# paste it when prompted. Token is NOT stored anywhere persistent.

set -e
cd "$(dirname "$0")/.."

MSG="${1:-auto: update Jumbo Royale}"

# Stage all changes
git add -A

# Check if there's anything to commit
if git diff --cached --quiet; then
  echo "[push] Nothing to commit. Working tree clean."
  exit 0
fi

# Commit
git commit -m "$MSG"

# Push (will use cached credentials or prompt)
# To use a token: GITHUB_TOKEN=xxx ./scripts/push.sh "msg"
if [ -n "$GITHUB_TOKEN" ]; then
  git push https://"${GITHUB_USER:-Chandima-Prabhath}:$GITHUB_TOKEN@github.com/Chandima-Prabhath/JUMBO-ROYALE.git" main
else
  git push origin main
fi

echo "[push] Done."
echo "[push] View at: https://github.com/Chandima-Prabhath/JUMBO-ROYALE"
