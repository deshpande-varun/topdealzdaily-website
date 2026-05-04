# topdealzdaily.com — Project Context

## What This Is
Amazon affiliate deals website. Scrapes 100+ deals/day from Amazon bestsellers + Slickdeals + GetMattsDeals, accumulates up to 1000 deals, deploys automatically to Vercel daily. Also auto-posts branded deal images to Instagram @topdealzzdaily.

## Domain & Hosting
- **Live site:** topdealzdaily.com (also amazingdeals17.vercel.app — amazonbestdealz.com redirects here)
- **Hosting:** Vercel — project `amazingdeals17-website` (Vercel project name unchanged)
- **Repo:** github.com/deshpande-varun/topdealzdaily-website

## Business Owner
Wife (H4 EAD) — all accounts, income, and Instagram are in her name. Varun is on H1B and cannot own the business.
- Amazon Associates affiliate tag: `amazingd0f292-20` (needs updating once wife's account is approved)
- Instagram: @topdealzzdaily (Business account, converted from @amazingdeals_17)

## Key Files
- `scripts/scrape-all.js` — daily orchestrator (`npm run scrape`)
- `scripts/scrapers/amazon-bestsellers.js` — scrapes 15 Amazon categories
- `scripts/scrapers/slickdeals.js` — Slickdeals RSS → ASINs + coupon codes
- `scripts/scrapers/getmattsdeals.js` — GetMattsDeals → ASINs + coupon codes
- `scripts/post-instagram.js` — auto-posts 3 deals/day to Instagram (feed post + story each)
- `scripts/create-deal-image.js` — generates branded 1080x1080 feed and 1080x1920 story images using `canvas`
- `scripts/create-reel-video.js` — Reels video generator (Ken Burns ffmpeg effect) — NOT wired into daily run, kept for future use
- `data/config.json` — affiliate tag, price range, site config
- `data/deals.json` — accumulated deals (up to 1000, newest first)
- `data/posted.json` — tracks ASINs already posted to Instagram (prevents duplicates)
- `.github/workflows/daily-scrape.yml` — GitHub Actions cron at 9am UTC daily

## Daily Pipeline
```
9am UTC → GitHub Actions → npm run scrape → commit deals.json → vercel --prod → node scripts/post-instagram.js
```

## Instagram Auto-Posting
- Posts top 3 unposted deals daily (prioritises deals with coupons, then highest % discount)
- Only posts deals with `/images/I/` Amazon image URLs (avoids broken `/images/P/` format)
- Each deal gets: **feed post** (1080x1080 JPEG) + **story** (1080x1920 JPEG)
- Images generated with `canvas` npm package — dark navy gradient background, white product card, teal header/footer, emerald price, amber CTA button, red discount badge
- Images hosted on Imgur (Client-ID: `546c25a59c58ad7`) — Authorization must be in HTTP **headers**, not request body
- Published via Instagram Graph API: create container → wait 8s → media_publish
- Stories use `media_type: 'STORIES'` (not `'IMAGE'`)
- Instagram account ID: `17841428043117890`
- **Access token expires ~60 days from issue** — current token issued ~May 2026, expires ~July 4 2026. Renew at: Meta Developer dashboard → topdealzzdaily app → Generate Token. Update GitHub secret `INSTAGRAM_ACCESS_TOKEN`.

## Image Design — Feed Post (1080x1080)
Fixed absolute Y-positions (nothing dynamic, no overflow possible):
- Header (teal bar): 0–90
- Product image card (white rounded rect): Y=108, H=490, bottom=598
- Product name line 1 baseline: Y=698
- Product name line 2 baseline: Y=750
- Price row baseline: Y=850 (strikethrough original + arrow + large emerald current price)
- CTA button (amber): Y=920, H=74
- Footer (teal bar): Y=1002–1080

## Image Design — Story (1080x1920)
Fixed absolute Y-positions:
- Header (teal bar): 0–110
- Product image card: CARD_Y=180, CARD_H=680, bottom=860
- Product name line 1 baseline: Y=970
- Product name line 2 baseline: Y=1032
- Price row baseline: Y=1140
- CTA button (amber): top=1230, H=110, text baseline=1303
- Divider: Y=1430
- Follow text (amber): Y=1520
- Handle (@topdealzzdaily): Y=1610
- Hashtags (single compact line): Y=1710
- Footer (teal bar): Y=1820–1920

## Color Palette
```js
BRAND_COLOR  = '#0e7490'  // teal — header, footer
ACCENT_COLOR = '#dc2626'  // red — discount badge
AMBER        = '#f59e0b'  // amber — CTA button, follow text
EMERALD      = '#10b981'  // green — current price
SLATE_BG1    = '#0f172a'  // dark navy — background top
SLATE_BG2    = '#1e3a5f'  // deep blue — background bottom
```

## GitHub Secrets (all set)
- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`
- `INSTAGRAM_ACCESS_TOKEN` — expires ~July 4 2026
- `APIFY_TOKEN`, `RAINFOREST_API_KEY` (unused — old scrapers removed)

## Affiliate Tag
Current: `amazingd0f292-20`
To update: change `affiliateTag` in `data/config.json`

## Outstanding / To-Do
1. Wife's Amazon Associates account approval → update `affiliateTag` in `data/config.json`
2. Attorney confirmation on H1B/H4 EAD business structure
3. Renew Instagram access token before ~July 4 2026
4. Reels auto-posting — `scripts/create-reel-video.js` exists (Ken Burns ffmpeg effect) but was disabled — revisit when design is improved

## Known Gotchas
- Amazon image URLs: `/images/I/` = reliable. `/images/P/` = blank/broken — filter these out
- Imgur upload: `Authorization: Client-ID xxx` must go in HTTP **headers** via `extraHeaders`, NOT in the POST body
- Instagram Stories: must set `media_type: 'STORIES'` on the container, otherwise it posts as a feed image
- Canvas text baseline: a 50px font extends ~40px above baseline — card bottom must be at least 60px above first name baseline or text overlaps the card
- ffmpeg on this Mac (Homebrew) does NOT have `drawtext` filter compiled in — bake all text into canvas frame before passing to ffmpeg
