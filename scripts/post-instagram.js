// Auto-posts top deals to Instagram @topdealzzdaily via Instagram Graph API
// Runs daily after scraper. Posts up to MAX_POSTS branded deal images.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createDealImage } = require('./create-deal-image');

const INSTAGRAM_ACCOUNT_ID = '17841428043117890';
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const MAX_POSTS = 3;
const DEALS_FILE = path.join(__dirname, '../data/deals.json');
const POSTED_FILE = path.join(__dirname, '../data/posted.json');
const IMAGES_DIR = path.join(__dirname, '../images/deals');

function apiPost(hostname, urlPath, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname,
      path: urlPath,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
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
  const result = await apiPost('api.imgur.com', '/3/image', { image: base64, type: 'base64' });
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

async function postDeal(deal) {
  if (!deal.imageUrl) throw new Error('No image URL');

  // Generate branded image
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const imgPath = path.join(IMAGES_DIR, `${deal.asin}.jpg`);
  await createDealImage(deal, imgPath);

  // Upload to Imgur for public URL
  const imgUrl = await uploadToImgur(imgPath);

  // Build caption
  const caption = buildCaption(deal);

  // Create Instagram media container
  console.log(`  Creating container for: ${deal.name.slice(0, 50)}...`);
  const container = await apiPost('graph.facebook.com', '/v19.0/' + INSTAGRAM_ACCOUNT_ID + '/media', {
    image_url: imgUrl,
    caption,
    access_token: ACCESS_TOKEN,
  });
  if (container.error) throw new Error(container.error.message);

  // Wait for container to be ready
  await new Promise(r => setTimeout(r, 8000));

  // Publish
  const result = await apiPost('graph.facebook.com', '/v19.0/' + INSTAGRAM_ACCOUNT_ID + '/media_publish', {
    creation_id: container.id,
    access_token: ACCESS_TOKEN,
  });
  if (result.error) throw new Error(result.error.message);

  // Clean up local image
  fs.unlinkSync(imgPath);

  console.log(`  Published! Post ID: ${result.id}`);
  return result.id;
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

  // Pick unposted deals with images, prioritize coupons then highest discount
  const candidates = deals
    .filter(d => d.imageUrl && d.imageUrl.includes('amazon.com') && !postedAsins.has(d.asin))
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

  console.log(`Posting ${candidates.length} deals to @topdealzzdaily...`);

  for (const deal of candidates) {
    try {
      const postId = await postDeal(deal);
      posted.push({ asin: deal.asin, name: deal.name, postId, postedAt: new Date().toISOString() });
      console.log(`  Done: ${deal.name.slice(0, 50)}`);
      // Wait 30s between posts to avoid rate limiting
      if (candidates.indexOf(deal) < candidates.length - 1) {
        await new Promise(r => setTimeout(r, 30000));
      }
    } catch (err) {
      console.error(`  Failed: ${deal.name.slice(0, 50)} — ${err.message}`);
    }
  }

  fs.writeFileSync(POSTED_FILE, JSON.stringify(posted, null, 2));
  console.log(`Done. ${posted.length} total deals posted to Instagram.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
