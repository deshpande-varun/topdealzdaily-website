const https = require('https');

const RSS_URLS = [
  'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',
  'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parsePrice(text) {
  const m = text.match(/\$([0-9]+\.[0-9]{2})/);
  return m ? parseFloat(m[1]) : null;
}

function parseCouponCode(text) {
  const patterns = [
    /(?:code|coupon|promo)[:\s]+([A-Z0-9]{4,20})/i,
    /use\s+code[:\s]+([A-Z0-9]{4,20})/i,
    /enter\s+(?:code|coupon)[:\s]+([A-Z0-9]{4,20})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].toUpperCase();
  }
  return null;
}

function parseCouponInfo(text) {
  if (/clip\s+the\s+coupon|coupon\s+on\s+product\s+page|on.page\s+coupon/i.test(text)) {
    const clipMatch = text.match(/\$([0-9]+(?:\.[0-9]{2})?)\s+off\s+when\s+you\s+(?:'?clip|apply)/i) ||
                      text.match(/clip\s+the\s+\$([0-9]+(?:\.[0-9]{2})?)\s+coupon/i);
    return { type: 'clip', amount: clipMatch ? parseFloat(clipMatch[1]) : null };
  }
  if (/subscribe\s*&?\s*save|s&s/i.test(text)) {
    return { type: 'subscribe_save', amount: null };
  }
  return null;
}

function parseRSS(xml) {
  const deals = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                       block.match(/<title>([\s\S]*?)<\/title>/);
    const descMatch = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                      block.match(/<description>([\s\S]*?)<\/description>/);
    const contentMatch = block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);

    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const desc = descMatch ? descMatch[1] : '';
    const content = contentMatch ? contentMatch[1] : '';
    const fullText = title + ' ' + desc + ' ' + content;

    // Only Amazon deals — must have data-store-slug="amazon" in the content
    if (!/data-store-slug="amazon"/i.test(content)) continue;

    // Extract ASIN from data-aps-asin attribute embedded by Slickdeals
    const asinMatch = content.match(/data-aps-asin="([A-Z0-9]{10})"/);
    if (!asinMatch) continue;
    const asin = asinMatch[1];

    const price = parsePrice(title) || parsePrice(desc);
    if (!price || price > 100) continue;

    // Extract image from Slickdeals CDN thumbnail
    const imgMatch = content.match(/src="(https:\/\/static\.slickdealscdn\.com\/attachment\/[^"]+\.thumb)"/);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    const couponCode = parseCouponCode(fullText);
    const couponInfo = parseCouponInfo(fullText);

    const originalPriceMatch = fullText.match(/list\s+price\s+of\s+\$([0-9]+(?:\.[0-9]{2})?)/i) ||
                                fullText.match(/(?:was|original|reg(?:ular)?)\s+\$([0-9]+(?:\.[0-9]{2})?)/i);
    const originalPrice = originalPriceMatch
      ? parseFloat(originalPriceMatch[1])
      : Math.round(price * (1.3 + Math.random() * 0.2));

    const cleanTitle = title
      .replace(/^\$[\d.]+ \| /, '')
      .replace(/\s+\$[\d.]+$/, '')
      .replace(/&amp;/g, '&')
      .trim();

    deals.push({
      id: asin,
      asin,
      name: cleanTitle.slice(0, 200),
      url: 'https://www.amazon.com/dp/' + asin,
      originalUrl: 'https://www.amazon.com/dp/' + asin,
      price,
      originalPrice: originalPrice > price ? originalPrice : Math.round(price * 1.35),
      currency: '$',
      imageUrl,
      category: 'Deals',
      couponCode,
      couponType: couponInfo ? couponInfo.type : null,
      couponAmount: couponInfo ? couponInfo.amount : null,
      source: 'slickdeals',
      rating: null,
      reviewCount: null,
      scrapedAt: new Date().toISOString(),
      status: 'pending',
    });
  }
  return deals;
}

async function scrapeSlickdeals() {
  const allDeals = [];
  const seenAsins = new Set();
  console.log('  Fetching Slickdeals RSS feeds...');

  for (const url of RSS_URLS) {
    try {
      const xml = await fetchUrl(url);
      const deals = parseRSS(xml);
      for (const deal of deals) {
        if (!seenAsins.has(deal.asin)) {
          seenAsins.add(deal.asin);
          allDeals.push(deal);
        }
      }
      const label = url.includes('popdeals') ? 'popular' : 'frontpage';
      console.log('  Slickdeals (' + label + '): ' + deals.length + ' Amazon deals');
    } catch (err) {
      console.warn('  Slickdeals feed failed: ' + err.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return allDeals;
}

module.exports = { scrapeSlickdeals };
