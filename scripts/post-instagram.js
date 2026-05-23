// Auto-posts top deals to Instagram @topdealzzdaily via Instagram Graph API
// Runs daily after scraper. Posts up to MAX_POSTS branded deal images + stories.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createDealImage, createStoryImage } = require('./create-deal-image');

const INSTAGRAM_ACCOUNT_ID = '17841428043117890';
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const MAX_POSTS = 2;
const DEALS_FILE = path.join(__dirname, '../data/deals.json');
const POSTED_FILE = path.join(__dirname, '../data/posted.json');
const IMAGES_DIR = path.join(__dirname, '../images/deals');

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
  if (container.error) throw new Error(container.error.message);

  await new Promise(r => setTimeout(r, 8000));

  const result = await apiPost('graph.facebook.com', '/v19.0/' + INSTAGRAM_ACCOUNT_ID + '/media_publish', {
    creation_id: container.id,
    access_token: ACCESS_TOKEN,
  });
  if (result.error) throw new Error(result.error.message);
  return result.id;
}


async function postDeal(deal) {
  if (!deal.imageUrl) throw new Error('No image URL');

  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  // Generate and post feed image
  console.log(`  Generating feed image...`);
  const feedPath = path.join(IMAGES_DIR, `${deal.asin}-feed.jpg`);
  await createDealImage(deal, feedPath);
  const feedUrl = await uploadToImgur(feedPath);
  const caption = buildCaption(deal);
  const feedPostId = await publishInstagramMedia(feedUrl, caption, 'IMAGE');
  fs.unlinkSync(feedPath);
  console.log(`  Feed post published: ${feedPostId}`);

  // Wait before posting story
  await new Promise(r => setTimeout(r, 5000));

  // Generate and post story
  console.log(`  Generating story image...`);
  const storyPath = path.join(IMAGES_DIR, `${deal.asin}-story.jpg`);
  await createStoryImage(deal, storyPath);
  const storyUrl = await uploadToImgur(storyPath);
  const storyPostId = await publishInstagramMedia(storyUrl, null, 'STORY');
  fs.unlinkSync(storyPath);
  console.log(`  Story published: ${storyPostId}`);

  return { feedPostId, storyPostId };
}

async function main() {
  if (!ACCESS_TOKEN) {
    console.error('INSTAGRAM_ACCESS_TOKEN env var not set');
    process.exit(1);
  }

  const deals = JSON.parse(fs.readFileSync(DEALS_FILE));
  let posted = [];
  if (fs.existsSync(POSTED_FILE)) {
    posted = JSON.parse(fs.readFileSync(POSTED_FILE));
  }

  const postedAsins = new Set(posted.map(p => p.asin));

  const candidates = deals
    .filter(d => d.imageUrl && d.imageUrl.includes('/images/I/') && !postedAsins.has(d.asin))
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
    return;
  }

  console.log(`Posting ${candidates.length} deals to @topdealzzdaily (feed + story each)...`);

  for (const deal of candidates) {
    try {
      console.log(`\nPosting: ${deal.name.slice(0, 60)}`);
      const { feedPostId, storyPostId } = await postDeal(deal);
      posted.push({ asin: deal.asin, name: deal.name, feedPostId, storyPostId, postedAt: new Date().toISOString() });
      console.log(`  Done.`);
      if (candidates.indexOf(deal) < candidates.length - 1) {
        await new Promise(r => setTimeout(r, 30000));
      }
    } catch (err) {
      console.error(`  Failed: ${deal.name.slice(0, 50)} — ${err.message}`);
    }
  }

  fs.writeFileSync(POSTED_FILE, JSON.stringify(posted, null, 2));
  console.log(`\nDone. ${posted.length} total deals posted to Instagram.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
