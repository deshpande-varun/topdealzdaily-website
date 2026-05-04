// Creates branded Instagram feed (1080x1080) and story (1080x1920) images
const { createCanvas, loadImage } = require('canvas');
const https = require('https');
const http = require('http');
const fs = require('fs');

const SIZE = 1080;
const BRAND_COLOR = '#0e7490';
const ACCENT_COLOR = '#dc2626';
const AMBER = '#f59e0b';
const EMERALD = '#10b981';
const SLATE_BG1 = '#0f172a';
const SLATE_BG2 = '#1e3a5f';

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

  // ── Fixed layout (all Y positions hardcoded, nothing can overflow) ──
  // Header:     0   – 90
  // Card:       108 – 660   (cardH = 552)
  // Name L1:    690          (baseline)
  // Name L2:    742          (baseline)
  // Price:      835          (baseline, large text)
  // Button:     900 – 974
  // Footer:     1002 – 1080

  const HEADER_H   = 90;
  const CARD_Y     = 108;
  const CARD_H     = 490;   // bottom = 598, leaves 60px gap before name
  const CARD_X     = 55;
  const CARD_W     = SIZE - 110;
  const NAME_Y1    = 698;   // top of text ~660, 62px below card bottom
  const NAME_Y2    = 750;
  const PRICE_Y    = 850;
  const BTN_Y      = 920;
  const BTN_H      = 74;
  const FOOTER_Y   = 1002;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, SLATE_BG1);
  grad.addColorStop(1, SLATE_BG2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Header
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, 0, SIZE, HEADER_H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('@topdealzzdaily', SIZE / 2, 62);

  // Product image card
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(CARD_X, CARD_Y, CARD_W, CARD_H, 20);
  ctx.fill();

  // Discount badge
  const discount = deal.originalPrice
    ? Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)
    : 0;
  if (discount >= 10) {
    ctx.fillStyle = ACCENT_COLOR;
    ctx.beginPath();
    ctx.arc(CARD_X + CARD_W - 5, CARD_Y + 5, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${discount}%`, CARD_X + CARD_W - 5, CARD_Y - 2);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('OFF', CARD_X + CARD_W - 5, CARD_Y + 30);
  }

  // Product image
  const imageUrl = deal.imageUrl.replace(/\._[A-Z_0-9,]+_\.jpg$/i, '._AC_SL1000_.jpg');
  try {
    const imgBuf = await fetchImageBuffer(imageUrl);
    const img = await loadImage(imgBuf);
    const pad = 28;
    const scale = Math.min((CARD_W - pad * 2) / img.width, (CARD_H - pad * 2) / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    const ix = CARD_X + (CARD_W - iw) / 2;
    const iy = CARD_Y + (CARD_H - ih) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(CARD_X, CARD_Y, CARD_W, CARD_H, 20);
    ctx.clip();
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();
  } catch (e) {
    ctx.fillStyle = BRAND_COLOR;
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏷️', SIZE / 2, CARD_Y + CARD_H / 2);
  }

  // Product name — exactly 2 lines, fixed positions
  const name = cleanText(deal.name);
  ctx.fillStyle = '#f1f5f9';
  ctx.textAlign = 'left';
  ctx.font = 'bold 38px sans-serif';
  const nameLines = wrapText(ctx, name, SIZE - 80);
  const nameYPositions = [NAME_Y1, NAME_Y2];
  for (let i = 0; i < Math.min(nameLines.length, 2); i++) {
    let line = nameLines[i];
    if (i === 1 && nameLines.length > 2) {
      while (ctx.measureText(line + '...').width > SIZE - 80) line = line.slice(0, -1);
      line += '...';
    }
    ctx.fillText(line, 40, nameYPositions[i]);
  }

  // Price row — strikethrough original + arrow + current price
  ctx.textAlign = 'left';
  if (deal.originalPrice && deal.originalPrice > deal.price) {
    ctx.font = '36px sans-serif';
    ctx.fillStyle = '#94a3b8';
    const origText = `$${deal.originalPrice.toFixed(2)}`;
    ctx.fillText(origText, 40, PRICE_Y);
    const origW = ctx.measureText(origText).width;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, PRICE_Y - 13);
    ctx.lineTo(40 + origW, PRICE_Y - 13);
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '36px sans-serif';
    ctx.fillText('→', 40 + origW + 14, PRICE_Y);
    const arrowW = ctx.measureText('→').width;

    ctx.font = 'bold 70px sans-serif';
    ctx.fillStyle = EMERALD;
    ctx.fillText(`$${deal.price.toFixed(2)}`, 40 + origW + arrowW + 28, PRICE_Y + 8);
  } else {
    ctx.font = 'bold 80px sans-serif';
    ctx.fillStyle = EMERALD;
    ctx.fillText(`$${deal.price.toFixed(2)}`, 40, PRICE_Y);
  }

  // CTA button — fixed position
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.roundRect(40, BTN_Y, SIZE - 80, BTN_H, 37);
  ctx.fill();
  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🛒  Shop Now — Link in Bio!', SIZE / 2, BTN_Y + 48);

  // Footer
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, FOOTER_Y, SIZE, SIZE - FOOTER_Y);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('@topdealzzdaily  •  topdealzdaily.com', SIZE / 2, FOOTER_Y + 48);

  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.92 });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

async function createStoryImage(deal, outputPath) {
  const W = 1080;
  const H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── Fixed story layout ──
  // Header:      0   – 110
  // Card:        130 – 870   (cardH = 740)
  // Name L1:     910
  // Name L2:     972
  // Price:       1080
  // CTA btn:     1160 – 1270
  // Divider:     1370
  // "Hot Deal":  1450
  // Big price:   1590
  // Follow:      1680
  // Hashtags:    1750
  // Footer:      1820 – 1920

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, SLATE_BG1);
  grad.addColorStop(1, SLATE_BG2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('@topdealzzdaily', W / 2, 74);

  // Product image card
  const CARD_X = 55, CARD_Y = 180, CARD_W = W - 110, CARD_H = 680;  // bottom=860, card more centered
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(CARD_X, CARD_Y, CARD_W, CARD_H, 24);
  ctx.fill();

  // Discount badge
  const discount = deal.originalPrice
    ? Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)
    : 0;
  if (discount >= 10) {
    ctx.fillStyle = ACCENT_COLOR;
    ctx.beginPath();
    ctx.arc(CARD_X + CARD_W - 10, CARD_Y + 10, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${discount}%`, CARD_X + CARD_W - 10, CARD_Y + 4);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('OFF', CARD_X + CARD_W - 10, CARD_Y + 40);
  }

  // Product image
  try {
    const imgBuf = await fetchImageBuffer(deal.imageUrl.replace(/\._[A-Z_0-9,]+_\.jpg$/i, '._AC_SL1000_.jpg'));
    const img = await loadImage(imgBuf);
    const pad = 40;
    const scale = Math.min((CARD_W - pad * 2) / img.width, (CARD_H - pad * 2) / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    const ix = CARD_X + (CARD_W - iw) / 2;
    const iy = CARD_Y + (CARD_H - ih) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(CARD_X, CARD_Y, CARD_W, CARD_H, 24);
    ctx.clip();
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();
  } catch (e) {
    ctx.fillStyle = BRAND_COLOR;
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏷️', W / 2, CARD_Y + CARD_H / 2);
  }

  // All Y positions measured carefully:
  // Card bottom = 130 + 680 = 810
  // Name 1 baseline = 920  (top of 50px text = 870, 60px gap from card)
  // Name 2 baseline = 982
  // Price baseline  = 1090 (top of 46px text = 1044, 62px gap from name 2)
  // CTA top         = 1180, bottom = 1290, text baseline = 1253
  // Divider         = 1370
  // Follow          = 1460
  // Handle          = 1545
  // Hashtags        = 1630
  // Hashtags 2      = 1690
  // Footer top      = 1820

  const name = cleanText(deal.name);
  ctx.fillStyle = '#f1f5f9';
  ctx.textAlign = 'left';
  ctx.font = 'bold 50px sans-serif';
  const nameLines = wrapText(ctx, name, W - 80);
  for (let i = 0; i < Math.min(nameLines.length, 2); i++) {
    let line = nameLines[i];
    if (i === 1 && nameLines.length > 2) {
      while (ctx.measureText(line + '...').width > W - 80) line = line.slice(0, -1);
      line += '...';
    }
    ctx.fillText(line, 40, i === 0 ? 970 : 1032);
  }

  // Price row — baseline 1140
  ctx.textAlign = 'left';
  if (deal.originalPrice && deal.originalPrice > deal.price) {
    ctx.font = '46px sans-serif';
    ctx.fillStyle = '#94a3b8';
    const origText = `$${deal.originalPrice.toFixed(2)}`;
    ctx.fillText(origText, 40, 1140);
    const origW = ctx.measureText(origText).width;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 1124);
    ctx.lineTo(40 + origW, 1124);
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '46px sans-serif';
    ctx.fillText('→', 40 + origW + 16, 1140);
    const arrowW = ctx.measureText('→').width;
    ctx.font = 'bold 94px sans-serif';
    ctx.fillStyle = EMERALD;
    ctx.fillText(`$${deal.price.toFixed(2)}`, 40 + origW + arrowW + 30, 1150);
  } else {
    ctx.font = 'bold 100px sans-serif';
    ctx.fillStyle = EMERALD;
    ctx.fillText(`$${deal.price.toFixed(2)}`, 40, 1140);
  }

  // CTA button — top=1230, height=110, text baseline=1303
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.roundRect(40, 1230, W - 80, 110, 55);
  ctx.fill();
  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🛒  Shop Now — Link in Bio!', W / 2, 1303);

  // Divider
  ctx.strokeStyle = 'rgba(148,163,184,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 1430);
  ctx.lineTo(W - 80, 1430);
  ctx.stroke();

  // Follow text
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('🔥 Follow for daily Amazon deals!', W / 2, 1520);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '38px sans-serif';
  ctx.fillText('@topdealzzdaily', W / 2, 1610);

  // Hashtags — single compact line
  ctx.fillStyle = '#3d5166';
  ctx.font = '26px sans-serif';
  ctx.fillText('#amazondeal #deals #amazon #discount #sale #savemoney', W / 2, 1710);

  // Footer — top=1820
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, 1820, W, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('topdealzdaily.com  •  @topdealzzdaily', W / 2, 1878);

  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.92 });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = { createDealImage, createStoryImage };
