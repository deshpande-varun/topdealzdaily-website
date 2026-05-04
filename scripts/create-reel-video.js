// Generates a 15-second 1080x1920 Reel MP4 with Ken Burns effect (slow zoom/pan)
// Text is baked into the background frame using canvas; ffmpeg handles zoom animation.

const { execSync } = require('child_process');
const { createCanvas, loadImage } = require('canvas');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const W = 1080;
const H = 1920;
const DURATION = 15;
const FPS = 30;

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

function cleanText(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/’/g, "'")
    .replace(/“/g, '"')
    .replace(/”/g, '"');
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

async function buildReelFrame(deal, framePath) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const BRAND_COLOR = '#0e7490';
  const ACCENT_COLOR = '#dc2626';
  const AMBER = '#f59e0b';
  const EMERALD = '#10b981';

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e3a5f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Header bar
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('@topdealzzdaily', W / 2, 76);

  // Product image card
  const CARD_X = 55, CARD_Y = 145, CARD_W = W - 110, CARD_H = 720;
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
    ctx.arc(CARD_X + CARD_W - 10, CARD_Y + 10, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${discount}%`, CARD_X + CARD_W - 10, CARD_Y + 5);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('OFF', CARD_X + CARD_W - 10, CARD_Y + 42);
  }

  // Product image
  const imageUrl = deal.imageUrl.replace(/\._[A-Z_0-9,]+_\.jpg$/i, '._AC_SL1000_.jpg');
  try {
    const imgBuf = await fetchImageBuffer(imageUrl);
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
    // fallback — card stays white
  }

  // ── Text section (below card, card bottom = 145+720 = 865) ──
  const name = cleanText(deal.name);

  // Product name — 2 lines max, baseline at 970 and 1032
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
    // Strikethrough line
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
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

  // CTA button — top=1240, height=110
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.roundRect(40, 1240, W - 80, 110, 55);
  ctx.fill();
  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🛒  Shop Now — Link in Bio!', W / 2, 1313);

  // Divider
  ctx.strokeStyle = 'rgba(148,163,184,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 1440);
  ctx.lineTo(W - 80, 1440);
  ctx.stroke();

  // Follow / handle
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('🔥 Follow for daily Amazon deals!', W / 2, 1530);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '38px sans-serif';
  ctx.fillText('@topdealzzdaily', W / 2, 1618);

  // Hashtags
  ctx.fillStyle = '#3d5166';
  ctx.font = '26px sans-serif';
  ctx.fillText('#amazondeal #deals #amazon #discount #sale #savemoney', W / 2, 1718);

  // Footer bar
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, H - 100, W, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('topdealzdaily.com  •  @topdealzzdaily', W / 2, H - 36);

  fs.writeFileSync(framePath, canvas.toBuffer('image/jpeg', { quality: 0.95 }));
}

async function createReelVideo(deal, outputPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));

  try {
    console.log('    Building reel frame...');
    const framePath = path.join(tmpDir, 'frame.jpg');
    await buildReelFrame(deal, framePath);

    const totalFrames = DURATION * FPS;

    // Ken Burns: start at 1.15x zoom, slowly zoom out to 1.0x, gentle right pan
    // zoompan filter: zoom expression decreases from 1.15 to 1.0 over totalFrames
    const zoomExpr = `if(lte(zoom\\,1.0)\\,1.15\\,max(1.0\\,zoom-0.15/${totalFrames}))`;
    const panPx = Math.round(W * 0.04); // ~43px pan over 15s
    const xExpr = `iw/2-(iw/zoom/2)+(${panPx}*on/${totalFrames})`;
    const yExpr = `ih/2-(ih/zoom/2)`;
    const zoompan = `zoompan=zoom='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${W}x${H}:fps=${FPS}`;

    const cmd = [
      'ffmpeg -y',
      `-loop 1 -i "${framePath}"`,
      `-t ${DURATION}`,
      `-vf "${zoompan}"`,
      `-c:v libx264 -preset fast -crf 22`,
      `-pix_fmt yuv420p`,
      `-movflags +faststart`,
      `"${outputPath}"`,
    ].join(' ');

    console.log('    Running ffmpeg Ken Burns zoom...');
    execSync(cmd, { stdio: 'pipe', timeout: 120000 });

    return outputPath;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
}

module.exports = { createReelVideo };
