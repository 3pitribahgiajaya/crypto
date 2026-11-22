# BEN AI — Multi-chain Trading Assistant

Static GitHub Pages dashboard for market monitoring, rule-based technical indicators, read-only wallet monitoring and manual trade planning.

## Features
- CoinGecko public market snapshot for BTC, ETH, BNB, POL and SOL.
- Experimental rule-based bias using RSI(14), EMA(20), EMA(50) on 30-day market history for BTC, ETH and BNB.
- Browser notifications while the page is open (not background push).
- EIP-1193 wallet connection and native balance reads for Ethereum, Polygon, Arbitrum One, Base and BNB Smart Chain.
- LONG/SHORT risk calculator with maximum configured risk of 5%.
- Local-only portfolio journal using browser localStorage.
- Basic PWA manifest and service worker cache.

## Publish
GitHub Actions deploys the root directory to GitHub Pages. Expected URL: https://3pitribahgiajaya.github.io/crypto/

## Important limitations
- Signals are transparent technical heuristics, not machine-learning predictions, guaranteed outcomes, or personalized investment advice.
- Public market APIs may rate-limit or be delayed.
- Notifications require the page to remain open; no server-side push service is configured.
- Ajaib account/API integration is not implemented or verified. The journal is manual and local only.
- Wallet integration requires an injected EIP-1193 provider. Mobile browsers without an injected wallet cannot connect.
- No transaction signing, token approvals, swaps, broker orders, or automated trading.

## Security
Never enter a seed phrase, private key, password, OTP, exchange API key, or GitHub token into this site. Do not add secrets to this public repository. See SECURITY.md.
