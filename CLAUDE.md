# amazonbestdealz.com — Project Context

## What This Is
Amazon affiliate deals website. Scrapes 100+ deals/day from Amazon bestsellers + Slickdeals, accumulates up to 1000 deals, deploys automatically to Vercel daily.

## Domain & Hosting
- **Live site:** topdealzdaily.com (also amazingdeals17.vercel.app, amazonbestdealz.com still points here)
- **Hosting:** Vercel — project `amazingdeals17-website`
- **Repo:** github.com/deshpande-varun/topdealzdaily-website

## Key Files
- `scripts/scrape-all.js` — daily orchestrator (run with `npm run scrape`)
- `scripts/scrapers/amazon-bestsellers.js` — scrapes 15 Amazon categories directly
- `scripts/scrapers/slickdeals.js` — Slickdeals RSS → ASINs + coupon codes
- `scripts/scrapers/getmattsdeals.js` — GetMattsDeals → ASINs + coupon codes
- `data/config.json` — affiliate tag, price range, site config
- `data/deals.json` — accumulated deals (up to 1000, newest first)
- `.github/workflows/daily-scrape.yml` — runs at 9am UTC daily

## Affiliate Tag
Current: `amazingd0f292-20` (needs updating when wife's Amazon Associates account is ready)
To update: change `affiliateTag` in `data/config.json`

## Daily Pipeline
```
9am UTC → GitHub Actions → npm run scrape → commit deals.json → vercel --prod
```

## GitHub Secrets (all set)
- VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_ORG_ID
- APIFY_TOKEN, RAINFOREST_API_KEY (unused — old scrapers removed)

## Outstanding
1. Wife's Amazon Associates account → new affiliate tag → update config.json
2. Instagram auto-posting (Instagram Graph API) — pending legal/account setup
3. Attorney confirmation on H1B/H4 EAD business structure

## Business Owner
Wife (H4 EAD) — account, income, and Instagram to be in her name.
Instagram: @amazingdeals_17 (to be converted to Business account under wife)
