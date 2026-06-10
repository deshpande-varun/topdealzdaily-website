// Auto-posts top deals to Instagram @topdealzzdaily via Instagram Graph API
// Runs daily after scraper. Posts up to MAX_POSTS branded deal images + stories.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createDealImage, createStoryImage } = require('./create-deal-image');

const INSTAGRAM_ACCOUNT_ID = '17841428043117890';
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_POSTS = 1;
const DEALS_FILE = path.join(__dirname, '../data/deals.json');
const POSTED_FILE = path.join(__dirname, '../data/posted.json');
const IMAGES_DIR = path.join(__dirname, '../images/deals');
const LOCK_FILE = path.join(__dirname, '../data/post-instagram.lock');

function apiPost(hostname, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...extraHeaders,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(data.slice(0, 200))); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function uploadToImgur(imgPath) {
  const base64 = fs.readFileSync(imgPath).toString('base64');
  const result = await apiPost(
    'api.imgur.com',
    '/3/image',
    { image: base64, type: 'base64' },
    { 'Authorization': 'Client-ID 546c25a59c58ad7' }
  );
  if (!result.success) throw new Error('Imgur upload failed: ' + JSON.stringify(result));
  return result.data.link;
}


function buildCaption(deal) {
  const discount = deal.originalPrice
    ? Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)
    : 0;
  const name = deal.name.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

  let caption = `🔥 ${name.substring(0, 100)}${name.length > 100 ? '...' : ''}\n\n`;
  caption += `💰 Now $${deal.price.toFixed(2)}`;
  if (discount >= 10) caption += ` (${discount}% OFF!)`;
  caption += '\n';
  if (deal.rating) caption += `⭐ ${deal.rating} stars (${(deal.reviewCount || 0).toLocaleString()} reviews)\n`;
  if (deal.couponCode) caption += `🏷️ Use code ${deal.couponCode} at checkout\n`;
  else if (deal.couponType === 'clip') caption += `✂️ Clip coupon on Amazon page\n`;
  caption += '\n🛒 Link in bio!\n\nFollow @topdealzzdaily for daily Amazon deals! 👇\n\n';
  caption += '#amazondeal #deals #sale #shopping #amazon #discount #dealoftheday #savemoney #onlineshopping #bargain';
  // Add ASIN as hidden tracking tag for exact duplicate detection
  caption += ` #ASIN${deal.asin}`;
  return caption;
}

async function publishInstagramMedia(imgUrl, caption, mediaType = 'IMAGE') {
  const containerBody = {
    image_url: imgUrl,
    access_token: ACCESS_TOKEN,
  };

  if (mediaType === 'STORY') {
    containerBody.media_type = 'STORIES';
  } else {
    containerBody.caption = caption;
  }

  const container = await apiPost(
    'graph.facebook.com',
    '/v19.0/' + INSTAGRAM_ACCOUNT_ID + '/media',
    containerBody
  );
  if (container.error) {
    console.error('Instagram API Error:', JSON.stringify(container.error));
    throw new Error(`${container.error.message} (code: ${container.error.code}, type: ${container.error.type})`);
  }

  await new Promise(r => setTimeout(r, 8000));

  const result = await apiPost('graph.facebook.com', '/v19.0/' + INSTAGRAM_ACCOUNT_ID + '/media_publish', {
    creation_id: container.id,
    access_token: ACCESS_TOKEN,
  });
  if (result.error) {
    console.error('Instagram Publish Error:', JSON.stringify(result.error));
    throw new Error(`${result.error.message} (code: ${result.error.code})`);
  }
  return result.id;
}


async function postDeal(deal) {
  if (!deal.imageUrl) throw new Error('No image URL');

  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  let feedPostId = null;
  let storyPostId = null;

  // Generate and post feed image
  console.log(`  Generating feed image...`);
  const feedPath = path.join(IMAGES_DIR, `${deal.asin}-feed.jpg`);
  await createDealImage(deal, feedPath);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would upload to Imgur and post to Instagram`);
    console.log(`  [DRY RUN] Image saved at: ${feedPath}`);
    feedPostId = 'DRY_RUN_FEED_ID';
  } else {
    const feedUrl = await uploadToImgur(feedPath);
    const caption = buildCaption(deal);
    feedPostId = await publishInstagramMedia(feedUrl, caption, 'IMAGE');
    fs.unlinkSync(feedPath);
    console.log(`  Feed post published: ${feedPostId}`);
  }

  // Wait before posting story
  await new Promise(r => setTimeout(r, DRY_RUN ? 100 : 5000));

  // Try to post story, but don't fail if it errors (to avoid duplicate feeds)
  try {
    console.log(`  Generating story image...`);
    const storyPath = path.join(IMAGES_DIR, `${deal.asin}-story.jpg`);
    await createStoryImage(deal, storyPath);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would upload to Imgur and post story to Instagram`);
      console.log(`  [DRY RUN] Image saved at: ${storyPath}`);
      storyPostId = 'DRY_RUN_STORY_ID';
    } else {
      const storyUrl = await uploadToImgur(storyPath);
      storyPostId = await publishInstagramMedia(storyUrl, null, 'STORY');
      fs.unlinkSync(storyPath);
      console.log(`  Story published: ${storyPostId}`);
    }
  } catch (storyErr) {
    console.error(`  Story failed (feed still posted): ${storyErr.message}`);
  }

  return { feedPostId, storyPostId };
}

async function getRecentInstagramPosts() {
  return new Promise((resolve, reject) => {
    const url = `/v19.0/${INSTAGRAM_ACCOUNT_ID}/media?fields=id,caption,timestamp&limit=30&access_token=${ACCESS_TOKEN}`;
    https.get({ hostname: 'graph.facebook.com', path: url }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            console.warn('Warning: Could not fetch Instagram posts:', json.error.message);
            resolve({ success: false, posts: [] });
          } else {
            resolve({ success: true, posts: json.data || [] });
          }
        } catch (e) {
          console.warn('Warning: Error parsing Instagram response:', e.message);
          resolve({ success: false, posts: [] });
        }
      });
    }).on('error', (e) => {
      console.warn('Warning: Network error fetching Instagram posts:', e.message);
      resolve({ success: false, posts: [] });
    });
  });
}

async function main() {
  if (DRY_RUN) {
    console.log('🧪 DRY RUN MODE - No actual posts will be made to Instagram');
    console.log('');
  }

  if (!ACCESS_TOKEN) {
    console.error('INSTAGRAM_ACCESS_TOKEN env var not set');
    process.exit(1);
  }

  // Check for lock file to prevent concurrent runs
  if (fs.existsSync(LOCK_FILE)) {
    const lockAge = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
    if (lockAge < 600000) { // 10 minutes
      console.log('Another instance is running (lock file exists). Exiting.');
      process.exit(0);
    } else {
      console.log('Stale lock file found (>10 min old). Removing and continuing.');
      fs.unlinkSync(LOCK_FILE);
    }
  }

  // Create lock file
  fs.writeFileSync(LOCK_FILE, new Date().toISOString());

  try {
    await runPosting();
  } finally {
    // Always remove lock file when done
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  }
}

async function runPosting() {

  const deals = JSON.parse(fs.readFileSync(DEALS_FILE));
  let posted = [];
  if (fs.existsSync(POSTED_FILE)) {
    posted = JSON.parse(fs.readFileSync(POSTED_FILE));
  }

  // Fetch recent Instagram posts to double-check for duplicates
  console.log('Checking Instagram for recent posts...');
  const igResult = await getRecentInstagramPosts();

  // If Instagram API fails AND we have posted items, abort to prevent duplicates
  // But if API succeeds with 0 posts (or few posts), that's OK - stories expire after 24h
  if (!igResult.success && posted.length > 0) {
    console.error('⚠️  SAFETY CHECK FAILED: Instagram API returned an error.');
    console.error('⚠️  This could mean the API is down, rate limited, or token expired.');
    console.error('⚠️  Aborting to prevent duplicate posts.');
    console.error(`⚠️  posted.json has ${posted.length} entries, but Instagram API failed.`);
    throw new Error('Instagram API check failed - aborting to prevent duplicates');
  }

  const igPosts = igResult.posts;

  // If API succeeded but returned 0 posts and we have 52 in posted.json, that's fine
  // Stories expire after 24h, so feed posts might be old/deleted
  if (igResult.success && igPosts.length === 0 && posted.length > 0) {
    console.log(`✓ Instagram API succeeded but returned 0 recent posts`);
    console.log(`  This is normal - stories expire after 24h and old feed posts may be deleted`);
    console.log(`  Will use posted.json (${posted.length} entries) for duplicate prevention`);
  }

  // Extract ASINs from Instagram captions using the #ASINXXXXXXX tag
  const igAsins = new Set();
  igPosts.forEach(post => {
    const caption = post.caption || '';
    const asinMatch = caption.match(/#ASIN([A-Z0-9]{10})/);
    if (asinMatch) {
      igAsins.add(asinMatch[1]);
    }
  });

  console.log(`Found ${igAsins.size} ASINs in Instagram feed (from ${igPosts.length} posts)`);

  const postedAsins = new Set(posted.map(p => p.asin));

  // Filter out deals that are already on Instagram
  const candidates = deals
    .filter(d => {
      if (!d.imageUrl || !d.imageUrl.includes('/images/I/')) return false;

      // Check both posted.json AND Instagram feed
      if (postedAsins.has(d.asin)) {
        console.log(`  Skipping ${d.asin} - in posted.json`);
        return false;
      }

      if (igAsins.has(d.asin)) {
        console.log(`  Skipping ${d.asin} - already on Instagram (not in posted.json - will sync)`);
        // Add to posted.json immediately to fix the discrepancy
        posted.push({
          asin: d.asin,
          name: d.name,
          feedPostId: null,
          storyPostId: null,
          postedAt: new Date().toISOString(),
          source: 'found-on-ig-during-safety-check'
        });
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const aHasCoupon = !!(a.couponCode || a.couponType);
      const bHasCoupon = !!(b.couponCode || b.couponType);
      if (aHasCoupon && !bHasCoupon) return -1;
      if (!aHasCoupon && bHasCoupon) return 1;
      const aDisc = a.originalPrice ? (a.originalPrice - a.price) / a.originalPrice : 0;
      const bDisc = b.originalPrice ? (b.originalPrice - b.price) / b.originalPrice : 0;
      return bDisc - aDisc;
    })
    .slice(0, MAX_POSTS);

  if (candidates.length === 0) {
    console.log('No new deals to post today.');
    console.log(`  Total deals in deals.json: ${deals.length}`);
    console.log(`  Deals with Amazon /images/I/ URLs: ${deals.filter(d => d.imageUrl && d.imageUrl.includes('/images/I/')).length}`);
    console.log(`  Already posted (in posted.json): ${posted.length}`);
    console.log(`  Already posted (found on Instagram): ${igAsins.size}`);
    return;
  }

  console.log(`Posting ${candidates.length} deals to @topdealzzdaily (feed + story each)...`);

  let successCount = 0;
  let lastError = null;

  for (const deal of candidates) {
    try {
      console.log(`\nPosting: ${deal.name.slice(0, 60)}`);
      const { feedPostId, storyPostId } = await postDeal(deal);
      posted.push({ asin: deal.asin, name: deal.name, feedPostId, storyPostId, postedAt: new Date().toISOString() });

      if (feedPostId && storyPostId) {
        console.log(`  ✓ Done (feed + story)`);
      } else if (feedPostId) {
        console.log(`  ⚠ Done (feed only, story failed)`);
      } else {
        console.log(`  ✗ Partial failure`);
      }

      successCount++;
      if (candidates.indexOf(deal) < candidates.length - 1) {
        await new Promise(r => setTimeout(r, 30000));
      }
    } catch (err) {
      console.error(`  ✗ Failed completely: ${deal.name.slice(0, 50)} — ${err.message}`);
      lastError = err;
    }
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would save ${posted.length} entries to posted.json (not saving)`);
    console.log(`[DRY RUN] Generated images are in: ${IMAGES_DIR}`);
  } else {
    fs.writeFileSync(POSTED_FILE, JSON.stringify(posted, null, 2));
    console.log(`\nDone. ${posted.length} total deals posted to Instagram.`);
  }
  console.log(`Success: ${successCount}/${candidates.length} posts`);

  if (successCount === 0 && candidates.length > 0) {
    throw new Error(`All posts failed. Last error: ${lastError?.message || 'Unknown'}`);
  }
}

main().catch(e => {
  console.error(e.message);
  // Clean up lock file on error
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
  }
  process.exit(1);
});
