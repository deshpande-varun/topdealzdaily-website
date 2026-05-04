# Automated Daily Deals Scraping

This document explains how to set up automated daily deal updates for your Amazing Deals website.

## ⚡ Quick Setup (GitHub Actions - Recommended)

This runs automatically in the cloud every day at 9 AM UTC.

### Step 1: Add Apify Token to GitHub Secrets

1. Go to your repository: https://github.com/deshpande-varun/topdealzdaily-website
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `APIFY_TOKEN`
5. Value: `<your-apify-token-from-~/.env>`
6. Click **Add secret**

### Step 2: Enable GitHub Actions

1. Go to **Actions** tab in your repository
2. If prompted, click **I understand my workflows, go ahead and enable them**
3. The workflow will run automatically every day at 9 AM UTC

### Step 3: Test Manual Run

1. Go to **Actions** → **Daily Deals Scraper**
2. Click **Run workflow** → **Run workflow**
3. Wait 2-3 minutes and check if deals were updated

### Adjust Schedule (Optional)

Edit `.github/workflows/daily-scrape.yml` and change the cron schedule:

```yaml
# Examples:
- cron: '0 9 * * *'   # 9 AM UTC (1 AM PST, 4 AM EST)
- cron: '0 14 * * *'  # 2 PM UTC (6 AM PST, 9 AM EST)
- cron: '0 17 * * *'  # 5 PM UTC (9 AM PST, 12 PM EST)
```

---

## 🤖 Option 2: Claude Code Agent (Local Automation)

Run a Claude agent on your machine that updates deals daily.

### Setup with Claude Code CLI

1. Create a cron job that runs daily:

```bash
# Edit your crontab
crontab -e

# Add this line (runs at 9 AM daily)
0 9 * * * cd ~/Desktop/topdealzdaily-website && npm run scrape && git add data/deals.json && git commit -m "Auto-update deals" && git push
```

2. **Or** use the Claude Code `/loop` skill:

```bash
# In Claude Code CLI, navigate to the project
cd ~/Desktop/topdealzdaily-website

# Run scraper every 24 hours
/loop 24h "run npm run scrape, commit the changes, and push to github"
```

---

## 📅 Option 3: Vercel Cron Jobs (Pro Plan)

If you have Vercel Pro, you can run serverless cron jobs.

### Create `api/cron/scrape.js`:

```javascript
export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Run scraper logic here
  // ... (would need to adapt scraper for serverless)

  res.status(200).json({ success: true, message: 'Deals updated' });
}
```

### Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/scrape",
    "schedule": "0 9 * * *"
  }]
}
```

---

## 🔍 Monitoring

### Check GitHub Actions Status:
- Visit: https://github.com/deshpande-varun/topdealzdaily-website/actions
- See recent runs and any errors

### Check Vercel Deployments:
- Visit: https://vercel.com/vds-projects-f8f56f7c/topdealzdaily-website
- See automatic deployments triggered by GitHub pushes

### Check Deal Updates:
- API: https://topdealzdaily-website.vercel.app/api/stats
- Shows `lastScrape` timestamp

---

## 🎯 Recommended Setup

**Use GitHub Actions (Option 1)** because:
✅ Free with GitHub  
✅ Runs in the cloud (no local machine needed)  
✅ Automatic git commits and deploys  
✅ Easy to monitor and debug  
✅ Works even if your computer is off  

The workflow is already created in `.github/workflows/daily-scrape.yml` - just add the secret and you're done!
