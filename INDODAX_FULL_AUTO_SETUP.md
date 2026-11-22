# BEN AI — Indodax full-auto build

## Current safety state
This repository now contains a Cloudflare Worker backend scaffold for INDODAX Trade API V2. It defaults to SAFE_SETUP: live orders are locked, withdrawals are not implemented, and the dashboard must never hold API secrets.

## Required API key permissions
Create a dedicated Trade API V2 key at https://indodax.com/trade_api with ONLY:
- Reading (View Only)
- Spot Trading (create/cancel orders)

Do NOT enable IDR or crypto withdrawals. Never paste the key/secret into GitHub, this chat, or the browser dashboard. Save the secret once in a password manager.

## Deploy Worker
From the worker directory:
1. Install Wrangler: npm install -g wrangler
2. Authenticate: wrangler login
3. Deploy: wrangler deploy
4. Add secrets:
   - wrangler secret put INDODAX_API_KEY
   - wrangler secret put INDODAX_API_SECRET
   - wrangler secret put BEN_DASH_TOKEN
5. Keep BEN_LIVE_TRADING_ENABLED=false until paper testing is complete.
6. Set a strong BEN_DASH_TOKEN (at least 32 random characters) and keep it private.

The Worker uses INDODAX Trade API V2 signed requests (HMAC-SHA256, X-APIKEY and Sign headers). It exposes /health and public /market, and protected /account, /open-orders, and /order routes. /order remains locked unless BEN_LIVE_TRADING_ENABLED is explicitly changed to true. It enforces a symbol allowlist (BTCIDR, ETHIDR), side/type validation, and a max quantity cap.

## Important deployment boundary
The GitHub repository can be updated from ChatGPT, but this environment does not have an authenticated Cloudflare deployment action. Therefore committing these files does NOT deploy or modify the existing Cloudflare Worker. Deploy the worker using Wrangler or the Cloudflare dashboard.

## Not yet implemented
- A persistent strategy scheduler and order/position state store (KV or Durable Object).
- Automated TP/SL and trailing-stop supervisor.
- Idempotency/order reconciliation and fee-aware risk sizing.
- End-to-end paper trading tests against live public market data.
- Dashboard authentication flow and Worker URL wiring.

Do not enable live mode until these are implemented and tested. The code currently provides authenticated manual order routing, not unattended autonomous trading.