// Sync posted.json with actual Instagram posts to prevent duplicates
// Run this after posting to catch any posts that succeeded but weren't tracked

const https = require('https');
const fs = require('fs');
const path = require('path');

const INSTAGRAM_ACCOUNT_ID = '17841428043117890';
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const DEALS_FILE = path.join(__dirname, '../data/deals.json');
const POSTED_FILE = path.join(__dirname, '../data/posted.json');

if (!ACCESS_TOKEN) {
  console.log('No token, skipping sync');
  process.exit(0);
}

const url = `/v19.0/${INSTAGRAM_ACCOUNT_ID}/media?fields=id,caption,timestamp&limit=50&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;

https.get({ hostname: 'graph.facebook.com', path: url }, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.error) {
        console.log('API error, skipping sync:', json.error.message);
        process.exit(0);
      }

      const igPosts = json.data || [];

      // If Instagram returns 0 posts, that's OK - nothing to sync
      if (igPosts.length === 0) {
        console.log('Instagram returned 0 posts, nothing to sync');
        process.exit(0);
      }

      const deals = JSON.parse(fs.readFileSync(DEALS_FILE));
      let posted = [];
      if (fs.existsSync(POSTED_FILE)) {
        posted = JSON.parse(fs.readFileSync(POSTED_FILE));
      }
      const postedAsins = new Set(posted.map(p => p.asin));

      const newPosts = [];

      igPosts.forEach(igPost => {
        const caption = igPost.caption || '';
        const productName = caption.split('\n')[0].replace('🔥 ', '').substring(0, 60);

        const match = deals.find(d => {
          const dealName = d.name.substring(0, 60);
          return productName.includes(dealName.substring(0, 30)) || dealName.includes(productName.substring(0, 30));
        });

        if (match && !postedAsins.has(match.asin)) {
          newPosts.push({
            asin: match.asin,
            name: match.name,
            feedPostId: igPost.id,
            storyPostId: null,
            postedAt: igPost.timestamp
          });
          postedAsins.add(match.asin);
        }
      });

      if (newPosts.length > 0) {
        const updated = posted.concat(newPosts);
        fs.writeFileSync(POSTED_FILE, JSON.stringify(updated, null, 2));
        console.log(`Synced ${newPosts.length} untracked Instagram posts to posted.json`);
      } else {
        console.log('All Instagram posts already tracked');
      }
    } catch (e) {
      console.log('Sync error:', e.message);
      process.exit(0);
    }
  });
}).on('error', (e) => {
  console.log('Request error:', e.message);
  process.exit(0);
});
