# BEN AI — Multi-chain Trading Assistant

A static, GitHub Pages-compatible dashboard for market snapshots, read-only wallet monitoring, and manual trade planning.

## Current scope
- Market snapshot via CoinGecko public endpoint (rate limits and availability apply).
- Optional wallet connection through an injected EIP-1193 provider.
- Native balance reads on Ethereum, Polygon, Arbitrum One, Base, and BNB Smart Chain.
- Long trade risk/reward calculator.
- No transaction signing, token approvals, custody, automatic orders, or broker execution.

## Run
Open `index.html` through GitHub Pages or a local static web server. A compatible wallet browser is needed for wallet monitoring.

## Publish with GitHub Pages
In repository Settings → Pages, choose **Deploy from a branch**, select `main` and folder `/(root)`, then Save. Wait for the Pages deployment workflow to finish. Site URL is normally `https://3pitribahgiajaya.github.io/crypto/`.

## Security model
- Never enter or paste a seed phrase or private key into this site.
- The wallet connection only requests account access and reads the native balance.
- No API secrets or private keys are included in the frontend.
- External dependencies/data providers are loaded from public endpoints; verify providers before use.
- Treat all market data as informational, not execution quotes.
- This project is not financial advice. Trading can result in loss.

See [SECURITY.md](SECURITY.md).
