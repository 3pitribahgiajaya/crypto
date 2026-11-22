# Ajaib Kripto API integration — secure implementation plan

## What is known
Ajaib publishes developer documentation for its Coin Exchange API:
- Overview: https://ajaib.gitbook.io/coin-exchange/overview
- Authentication: https://ajaib.gitbook.io/coin-exchange/getting-started/authentication
- Support contact referenced in the API documentation: tech@ajaib.co.id

The API is documented as covering market information, wallet information and spot trading. Access/authentication requirements must be confirmed directly with Ajaib before production use.

## Why this static GitHub Pages app does not call authenticated endpoints
Ajaib signed API requests require credentials/signatures. A static public website cannot safely protect a private signing key: any secret embedded in JavaScript or repository files can be extracted by visitors. Therefore BEN AI must not call authenticated Ajaib endpoints directly from the browser.

## Required secure architecture
1. Contact Ajaib through its official API documentation/support channel and request API access, scope, limits, test environment and production approval.
2. Confirm whether read-only market/account scopes can be issued separately from trade scopes.
3. Deploy a private backend/API proxy (not GitHub Pages) with secrets held in a server-side secret manager.
4. Start with read-only balances/orders. Do not enable trading until authentication, request signing, nonce/timestamp validation, rate limits, IP restrictions and audit logs are tested.
5. If trading is later enabled, use least-privilege credentials, withdrawals disabled, explicit per-order user confirmation, max-order limits and a kill switch.
6. Never paste API private keys, seed phrases, passwords, OTPs or recovery codes into ChatGPT, GitHub issues, browser code or this repository.

## Current BEN AI status
- Ajaib account connection: NOT connected.
- Ajaib API credentials: NOT configured.
- Authenticated portfolio sync: NOT implemented.
- Ajaib order placement: NOT implemented.
- Current Portfolio Journal is a local manual note only.

This is intentional. A working, secure broker integration requires Ajaib-issued API access and a server-side runtime. GitHub Pages alone is not a safe place to store signing credentials.
