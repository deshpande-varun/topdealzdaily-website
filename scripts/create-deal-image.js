// Creates a 1080x1080 Instagram deal image with product photo + overlay
const { createCanvas, loadImage } = require('canvas');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SIZE = 1080;
const BRAND_COLOR = '#26758d';
const ACCENT_COLOR = '#e63946';

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function cleanText(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

async function createDealImage(deal, outputPath) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Load and draw product image (top 60% of canvas)
  const imageUrl = deal.imageUrl.replace(/\._[A-Z_0-9,]+_\.jpg$/i, '._AC_SL1000_.jpg');
  try {
    const imgBuf = await fetchImageBuffer(imageUrl);
    const img = await loadImage(imgBuf);
    const imgAreaHeight = SIZE * 0.58;
    const scale = Math.min(SIZE / img.width, imgAreaHeight / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    const ix = (SIZE - iw) / 2;
    const iy = (imgAreaHeight - ih) / 2;

    // White product background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, imgAreaHeight);
    ctx.drawImage(img, ix, iy, iw, ih);
  } catch (e) {
    // Fallback: solid brand color background
    ctx.fillStyle = BRAND_COLOR;
    ctx.fillRect(0, 0, SIZE, SIZE * 0.58);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏷️ Deal', SIZE / 2, SIZE * 0.3);
  }

  // Bottom info panel
  const panelY = SIZE * 0.58;
  const panelH = SIZE * 0.42;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, panelY, SIZE, panelH);

  // Brand top bar
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, panelY, SIZE, 6);

  // Discount badge (top right of image area)
  const discount = deal.originalPrice
    ? Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)
    : 0;

  if (discount >= 10) {
    const badgeX = SIZE - 160;
    const badgeY = panelY - 70;
    ctx.fillStyle = ACCENT_COLOR;
    ctx.beginPath();
    ctx.arc(badgeX + 65, badgeY + 35, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${discount}%`, badgeX + 65, badgeY + 28);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('OFF', badgeX + 65, badgeY + 56);
  }

  // Product name
  const name = cleanText(deal.name);
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'left';
  ctx.font = 'bold 38px sans-serif';
  const nameLines = wrapText(ctx, name, SIZE - 80);
  const maxNameLines = 2;
  for (let i = 0; i < Math.min(nameLines.length, maxNameLines); i++) {
    let line = nameLines[i];
    if (i === maxNameLines - 1 && nameLines.length > maxNameLines) {
      while (ctx.measureText(line + '...').width > SIZE - 80) {
        line = line.slice(0, -1);
      }
      line += '...';
    }
    ctx.fillText(line, 40, panelY + 60 + i * 48);
  }

  // Original price (struck through) on its own line
  const priceY = panelY + 170;
  if (deal.originalPrice && deal.originalPrice > deal.price) {
    ctx.font = '36px sans-serif';
    ctx.fillStyle = '#9ca3af';
    const origText = `Was: $${deal.originalPrice.toFixed(2)}`;
    ctx.fillText(origText, 40, priceY);
    const origWidth = ctx.measureText(origText).width;
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, priceY - 12);
    ctx.lineTo(40 + origWidth, priceY - 12);
    ctx.stroke();
  }

  // Current price large on next line
  const nowPriceY = priceY + 72;
  ctx.font = 'bold 80px sans-serif';
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillText(`$${deal.price.toFixed(2)}`, 40, nowPriceY);

  // Rating
  if (deal.rating) {
    ctx.font = '32px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`⭐ ${deal.rating} (${(deal.reviewCount || 0).toLocaleString()} reviews)`, 40, nowPriceY + 48);
  }

  // Coupon badge
  if (deal.couponCode || deal.couponType) {
    const couponY = priceY + 190;
    ctx.fillStyle = '#fef9c3';
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, couponY - 30, SIZE - 80, 50, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    if (deal.couponCode) {
      ctx.fillText(`🏷️ Use code: ${deal.couponCode} at checkout`, SIZE / 2, couponY + 8);
    } else if (deal.couponType === 'clip') {
      ctx.fillText('✂️ Clip coupon on Amazon page for extra savings!', SIZE / 2, couponY + 8);
    }
  }

  // Footer
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, SIZE - 70, SIZE, 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('@topdealzzdaily  •  topdealzdaily.com', SIZE / 2, SIZE - 25);

  // Save
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.92 });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = { createDealImage };
