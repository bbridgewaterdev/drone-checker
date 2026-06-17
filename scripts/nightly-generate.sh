#!/bin/bash
# Nightly hazard tile generation → Firebase deploy → GitHub backup
# Scheduled at 03:00 and 05:00; 05:00 run exits early if 03:00 already finished everything.
# stdout/stderr captured by launchd to ~/Library/Logs/dronechecker-hazard-tiles.log

NPM=/Users/Ben/.nvm/versions/node/v24.16.0/bin/npm
FIREBASE=/Users/Ben/.nvm/versions/node/v24.16.0/bin/firebase
NODE=/Users/Ben/.nvm/versions/node/v24.16.0/bin/node
REPO=/Users/Ben/Documents/GitHub/drone-checker
MANIFEST="$REPO/hazard-tiles/v1/manifest.json"
TOTAL_TYPES=9

echo "=== $(date) ==="

# Skip if all types are already complete
if [ -f "$MANIFEST" ]; then
  COMPLETED=$($NODE -p "require('$MANIFEST').completedKeys.length" 2>/dev/null || echo 0)
  if [ "$COMPLETED" -eq "$TOTAL_TYPES" ]; then
    echo "All $TOTAL_TYPES hazard types complete — nothing to do"
    exit 0
  fi
  echo "Currently complete: $COMPLETED/$TOTAL_TYPES — proceeding"
fi

cd "$REPO/scripts"
$NPM run generate || { echo "Generate failed — aborting"; exit 1; }

$FIREBASE deploy --only hosting

cd "$REPO"
git add hazard-tiles/
if ! git diff --cached --quiet; then
  git commit -m "chore: update hazard tiles [automated $(date '+%Y-%m-%d')]"
  git push origin main
else
  echo "No new tiles — nothing to commit"
fi
