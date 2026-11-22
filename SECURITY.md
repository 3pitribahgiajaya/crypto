# Security notes

## Explicit limitations
BEN AI is a static client-side application. It does not authenticate users with a backend, hold credentials, store sessions, or act as a custodian. GitHub repository access is separate from wallet access.

## Wallet safety
- Never request, transmit, store, or log seed phrases/private keys.
- Wallet interaction uses the browser-injected EIP-1193 provider.
- The current app only requests account connection, chain switching, and native balance reads.
- It does not call `eth_sendTransaction`, sign messages, approve tokens, or submit orders.

## Secrets
- Do not add exchange API keys, private keys, RPC credentials, or personal access tokens to HTML, JavaScript, or any public repository.
- If authenticated exchange execution is added later, use a trusted backend, least-privilege API keys, withdrawal disabled, secret manager, rate limits, audit logs, and explicit user confirmation.
- Rotate any secret accidentally committed to Git history.

## Third-party services
The dashboard loads ethers.js from jsDelivr and market data from CoinGecko. These providers can observe requests and may change availability or terms. Pin and review dependencies before production use.

## Reporting
Do not publish exploit details or credentials in issues. Contact the repository owner privately.
