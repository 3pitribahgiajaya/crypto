# BEN AI — Indodax deployment and safety checklist

The Worker now requires a separate explicit human approval for every BUY or SELL order. The backend rejects missing or incorrect approval with HTTP 428 before making any request to Indodax. Live trading remains disabled by default in `wrangler.toml`.

## Automated test gate
Every push affecting `worker/**` runs `npm test` on Node.js 22. Deployment is blocked unless the test job succeeds. Tests use mocked exchange responses; they do not submit real orders or prove that an Indodax account, API key, network, or Cloudflare deployment is operational.

## Per-transaction approval protocol
For each proposed order, the UI must show the exact market, side, order type, and amount/price. The user must actively confirm that specific order. Only then may it send:
- `approvalConfirmed: true`
- `approvalPhrase`: exact phrase returned by the server's HTTP 428 response.

Examples of exact approval phrases:
- Market BUY BTCIDR for Rp50,000: `SETUJUI BUY BTCIDR MARKET IDR 50000`
- Market SELL BTCIDR quantity 0.00005: `SETUJUI SELL BTCIDR MARKET qty 0.00005`
- Limit BUY ETHIDR quantity 0.001 at price 50,000,000: `SETUJUI BUY ETHIDR LIMIT qty 0.001 @ 50000000`

The server revalidates the phrase against the order payload. A missing or incorrect phrase is rejected before calling the exchange. Never implement automatic approval, default-checked approval, or approval of a batch of future orders. A changed amount, price, symbol, side, or order type requires a new approval.

## GitHub → Cloudflare deployment
The workflow `.github/workflows/deploy-worker.yml` runs tests first, then deploys only if tests pass. In GitHub repository Settings → Secrets and variables → Actions, add:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with permission to edit Workers Scripts for the target account.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.

If these secrets are absent, deployment will fail safely after the tests; no deployment occurs.

## Cloudflare Worker secrets
After deployment, set these using Wrangler from the worker folder:
- `wrangler secret put INDODAX_API_KEY`
- `wrangler secret put INDODAX_API_SECRET`
- `wrangler secret put BEN_DASH_TOKEN`

Use a unique random dashboard token. Never put these values in source code, GitHub files, or this chat.

## Indodax API key
Create a dedicated Trade API V2 key at https://indodax.com/trade_api with Reading and Spot Trading only. Leave IDR & Crypto Withdrawal disabled. The secret is shown once; store it securely.

## Current backend behavior
- `GET /health`: reports safe/live flag, approval required, and withdrawals disabled.
- `GET /market`: public ticker.
- Bearer-protected `GET /account` and `GET /open-orders`.
- Bearer-protected `POST /order`: live switch must be enabled; BTCIDR/ETHIDR only; configured quantity/IDR caps apply; every order requires exact per-order human approval.
- No withdrawal endpoint exists.

## Still not production-ready for unattended trading
This is not an autonomous trading bot. It does not yet include durable position/order state, a scheduler, entry strategy, fee-aware position sizing, TP/SL supervisor, fill reconciliation, duplicate-order protection, stale-price/spread checks, kill switch, alerting, or a complete dashboard approval interface. Do not arm live trading. The automated tests are simulated code tests only, not proof of live exchange execution.
