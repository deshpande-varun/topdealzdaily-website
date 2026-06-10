#!/bin/bash
set -e

echo "=== TESTING INSTAGRAM POSTING WORKFLOW ==="
echo ""
echo "Step 1: Run scraper"
npm run scrape
echo ""
echo "Step 2: Post to Instagram"
node scripts/post-instagram.js
echo ""
echo "Step 3: Sync with Instagram"
node scripts/sync-posted.js
echo ""
echo "Step 4: Check for changes"
git diff --stat data/deals.json data/posted.json
echo ""
echo "=== TEST COMPLETE ==="
