# Keep-Warm Strategy for Render Free Tier

## Problem
Render Free tier spins down services after ~15 minutes of inactivity. Cold start takes 30-60 seconds, causing timeouts on first requests.

## Solution: External Ping Monitor

### Option 1: UptimeRobot (Free)
1. Create account at https://uptimerobot.com
2. Add new monitor:
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://iara-os3h.onrender.com/health`
   - **Monitoring Interval**: 5 minutes
   - **Alert Contacts**: Add email/Telegram for notifications
3. Save

### Option 2: cron-job.org (Free)
1. Create account at https://cron-job.org
2. Create cronjob:
   - **URL**: `https://iara-os3h.onrender.com/health`
   - **Schedule**: Every 5 minutes (`*/5 * * * *`)
   - **Headers**: Optional `User-Agent: keep-warm-bot`
   - **Enabled**: Yes
3. Save

### Option 3: GitHub Actions (Free for public repos)
```yaml
# .github/workflows/keep-warm.yml
name: Keep Warm
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping backend
        run: |
          curl -fsS https://iara-os3h.onrender.com/health > /dev/null
          curl -fsS https://iara-os3h.onrender.com/api/products > /dev/null
```

### Option 4: Render Paid Plan (No Sleep)
Upgrade to Render Starter ($7/mo) or Standard ($25/mo) to disable spin-down entirely.

## Verification
After setup, verify:
```bash
# Should return 200 in <1s (warm)
curl -w "%{http_code} %{time_total}s\n" -s -o /dev/null https://iara-os3h.onrender.com/health

# Should return 200 with products
curl -s https://iara-os3h.onrender.com/api/products | jq length
```

## Frontend Cold-Start Handling
The frontend `fetchWithRetry` in `ui.js` handles cold start automatically:
- First attempt: 50s timeout (waits for Render to wake)
- Retries: 3x with exponential backoff (1s → 2s → 4s) + jitter
- Only retries on: timeout, network error, 502/503/504
- Shows friendly toast: "El servidor está iniciando, esperá unos segundos..."

## Health Endpoint
`GET /health` - Lightweight, no auth, returns:
```json
{
  "status": "ok",
  "uptime": 123,
  "checks": {"database": "ok", "sentry": "disabled", "blob": "configured"},
  "timestamp": "2026-10-11T12:00:00.000Z"
}
```
- Returns 200 when healthy, 503 when degraded
- Used by keep-warm pings and frontend warmup

## Image Storage: Neon (base64 in DB)
Images are stored as base64 data URIs directly in Neon PostgreSQL. No external Blob storage required.

- Upload endpoint (`/api/admin/upload`) converts files to base64 data URIs
- Stored in `product_images.url` and `products.image` as `data:image/...;base64,...`
- Works without Vercel Blob token
- Trade-off: larger DB size, no CDN (images served from API)

## Monitoring Checklist
- [ ] UptimeRobot/cron-job.org configured and active
- [ ] `/health` returns 200 in <1s after 10 min idle
- [ ] Frontend shows "El servidor está iniciando..." toast on cold start
- [ ] Page loads completely within 60s on cold start
- [ ] Images load from correct domains (no iara-alpha.vercel.app)
- [ ] Hero/Carousel images updated in Admin to use correct URLs