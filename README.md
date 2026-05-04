# topdealzdaily.com 🔥

Daily Amazon deals website with Instagram auto-posting for [@topdealzzdaily](https://instagram.com/topdealzzdaily)

## Features

✅ **Public Website** - Deal grid at topdealzdaily.com
✅ **Automated Scraping** - 100+ Amazon deals/day from bestsellers, Slickdeals, GetMattsDeals
✅ **Instagram Auto-Posting** - Branded feed post + story per deal, fully automated
✅ **Affiliate Integration** - Amazon Associates tracking
✅ **Smart Filtering** - Prioritises coupons and highest % discount

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **Scraping:** Node.js (direct Amazon + RSS)
- **Image Generation:** `canvas` npm package
- **Hosting:** Vercel (free tier)
- **Scheduling:** GitHub Actions (9am UTC daily)
- **Instagram:** Meta Graph API

## Setup

### 1. Install Dependencies

```bash
cd topdealzdaily-website
npm install
```

### 2. Run Scraper Locally

```bash
npm run scrape
```

### 3. Post to Instagram Manually

```bash
INSTAGRAM_ACCESS_TOKEN=your_token node scripts/post-instagram.js
```

## Daily Pipeline

```
9am UTC → GitHub Actions → npm run scrape → commit deals.json → vercel --prod → post-instagram.js
```

## Configuration

Edit `data/config.json` to update affiliate tag, price range, categories.

## File Structure

```
topdealzdaily-website/
├── public/                    # Public website
├── admin/                     # Admin dashboard
├── scripts/
│   ├── scrape-all.js          # Daily scraper orchestrator
│   ├── scrapers/              # Amazon, Slickdeals, GetMattsDeals scrapers
│   ├── post-instagram.js      # Instagram auto-poster
│   ├── create-deal-image.js   # Feed + story image generator
│   └── create-reel-video.js   # Reel video generator (not in daily run)
├── data/
│   ├── deals.json             # Accumulated deals (up to 1000)
│   ├── posted.json            # ASINs already posted to Instagram
│   └── config.json            # Affiliate tag, site config
└── images/                    # Profile pictures, deal images
```

## GitHub Secrets Required

- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`
- `INSTAGRAM_ACCESS_TOKEN` — expires every 60 days, renew at Meta Developer dashboard

## Support

Questions? DM [@topdealzzdaily](https://instagram.com/topdealzzdaily)

---

Made with ❤️ for finding amazing Amazon deals!
