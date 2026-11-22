# BEN AI — Indodax deployment checklist

The GitHub repository contains a Cloudflare Worker backend scaffold. It defaults to SAFE_SETUP and refuses live orders until explicitly armed. It does not include an autonomous scheduler, TP/SL position supervisor, or persistent order state yet; do not enable live mode.

## GitHub → Cloudflare deployment
The workflow `.github/workflows/deploy-worker.yml` deploys the Worker on changes under `worker/`. In GitHub repository Settings → Secrets and variables → Actions, add:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with permission to edit Workers Scripts for the target account.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.

If these secrets are absent, the workflow will fail safely and no deployment occurs.

## Cloudflare Worker secrets
After deployment, set these using Wrangler from the worker folder:
- `wrangler secret put INDODAX_API_KEY`
- `wrangler secret put INDODAX_API_SECRET`
- `wrangler secret put BEN_DASH_TOKEN`

Use a unique random dashboard token. Never put these values in source code, GitHub files, or this chat.

## INDODAX API key
Create a dedicated Trade API V2 key at https://indodax.com/trade_api with Reading and Spot Trading only. Leave IDR & Crypto Withdrawal disabled. The secret is shown once; store it in a password manager.

## Current backend behavior
- `GET /health`: reports safe/live flag without exposing secrets.
- `GET /market`: public ticker.
- Protected `GET /account` and `GET /open-orders`.
- Protected `POST /order`: disabled unless `BEN_LIVE_TRADING_ENABLED=true`; symbol allowlist BTCIDR/ETHIDR; market BUY uses quoteOrderQty (IDR); quantity and price caps are enforced.
- No withdrawal endpoint exists.

## Not production-ready for unattended trading
Before any live automation, implement and test: durable position/order state (KV or Durable Objects), scheduler, entry filters, fee-aware sizing for the actual IDR 50,000 budget, partial take-profit, stop-loss and trailing-stop supervisor, fill reconciliation, duplicate-order protection, stale-price/spread checks, kill switch, and alerting. A stop order placed only in browser memory is not safe.

Do not arm live orders until these tests pass with small paper simulations and account balances have been verified.