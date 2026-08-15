# Agent Commerce Hub

Agent Commerce Hub is a marketplace where AI services are discovered, paid per call through GOAT Flow/x402, and fulfilled only after trusted backend payment confirmation.

## Current vertical slice

- Searchable service marketplace and machine-readable manifests
- Service detail, schemas, pricing, and ERC-8004 identity metadata
- Idempotent `402 Payment Required` invocation flow
- Mock payment adapter for local development
- GOAT Flow DIRECT order and backend proof adapter
- Payment-to-fulfillment state machine with receipt hashing
- Wallet nonce authentication with replay-safe, hashed sessions
- Protected seller profiles and service draft onboarding
- SSRF-resistant endpoint verification with JSON Schema checks
- ERC-8004 owner/agent-wallet and on-chain URI verification
- Per-seller GOAT Flow DIRECT merchant verification and encrypted credentials
- Publish gates and PostgreSQL-backed dynamic marketplace catalog
- Public metrics that exclude simulations and internal activity
- PostgreSQL repository for auth, sellers, services, invocations, and receipts
- Stateless MCP Streamable HTTP endpoint for autonomous service discovery and invocation
- Live QuickPay discovery and backend-verified fulfillment for the fixed-price Wallet Analysis product

The seed service metrics are intentionally zero. The UI does not present fabricated transaction activity.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The default `PAYMENT_PROVIDER=mock` exercises the full invocation state machine without sending funds.

Memory storage is the zero-setup development default. For persistent PostgreSQL storage:

```bash
docker compose up -d postgres
npm run db:migrate
# Set DATA_STORE=postgres in .env.local, then restart npm run dev
```

`db:generate` is only needed after changing `src/db/schema.ts`; generated migrations and Drizzle journal metadata are committed to the repository.

Seller onboarding is available at `/sell`. The wallet signs a five-minute, single-use challenge. The backend stores only a SHA-256 digest of the session token in PostgreSQL and sends the raw token in an `HttpOnly`, `SameSite=Lax` cookie.

Set `CREDENTIAL_ENCRYPTION_KEY` to a 32-byte base64 value before accepting seller payment credentials:

```bash
openssl rand -base64 32
```

New seller services remain `draft` until all three publish gates pass:

1. The HTTPS endpoint returns JSON matching the declared output schema for the seller-provided test input. DNS is resolved to a public IP and pinned for the request; redirects, private networks, responses over 1 MB, and responses slower than 15 seconds are rejected.
2. ERC-8004 `ownerOf`, `getAgentWallet`, and `tokenURI` prove the signed-in wallet controls the submitted agent identity.
3. The seller's GOAT Flow merchant is DIRECT and exposes the exact GOAT chain, token, and receiving-wallet route. The supplied credentials must create a one-unit test order whose payment target matches the seller wallet; the order is then cancelled. Credentials are encrypted with AES-256-GCM and never returned by APIs.

Published services are loaded from PostgreSQL by both the human marketplace and public API. Each external seller invocation uses that seller's own encrypted merchant credentials, so payment settles to the verified seller route.

## GOAT Flow configuration

Switch to the production payment adapter only after merchant configuration is complete:

```bash
PAYMENT_PROVIDER=goat-flow
GOATX402_API_URL=https://flow-api.testnet3.goat.network
GOATX402_API_KEY=...
GOATX402_API_SECRET=...
GOAT_CHAIN_ID=48816
GOATX402_RECEIVING_WALLET=0x...
```

For mainnet use chain ID `2345`, `https://flow-api.goat.network`, `GOATX402_RECEIVING_WALLET=0x2c06D8eBB95678944C9Ba9f67284619BA7AcAE51`, and the matching merchant/token route. First-party payment creation rejects seed services whose receiving wallet does not match this configured route. Never expose merchant credentials in browser environment variables.

The production merchant also publishes the fixed-price `wallet-analysis` product as **Wallet Analysis** at `0.10 USDC` through QuickPay:

- [Agent-readable instructions](https://flow-quickpay.goat.network/quickpay/agentcommercehub/agent.md)
- [Machine-readable manifest](https://flow-quickpay.goat.network/quickpay/agentcommercehub/manifest.json)

The public QuickPay listing is live and discoverable. Wallet Analysis invocations open the hosted checkout with the invocation ID as the client reference, bind the returned session ID to exactly one invocation, and verify both the trusted QuickPay session snapshot and the merchant-authenticated GOAT order proof before execution. The browser callback remains a UX signal only. Founder, first-party seller, and configured test wallets are excluded from headline external metrics.

Agents use the `quickPay.idempotencyKey` returned by `invoke_service` when purchasing `quickPay.productKey`, then call `confirm_invocation` with the resulting QuickPay `session_id`. Reusing the same invocation or session is safe; attempting to bind a session to a second invocation is rejected.

The browser checkout also has a BTC-first preparation path. If the payer lacks enough GOAT USDC.e, the app reads the live WGBTC/USDC.e quote from the official OKU QuoterV2 and offers one native-BTC swap through SwapRouter02. The router wraps BTC within the same transaction, the minimum output is pinned to the exact USDC deficit, gas is reserved before submission, and the token balance is checked again before QuickPay opens. The swap prepares the payment asset; only the separately verified QuickPay service payment counts as a paid invocation.

## API

```text
GET  /api/v1/services
GET  /api/v1/services/:slug
GET  /api/v1/services/:slug/metrics
GET  /api/v1/services/:slug/health
POST /api/v1/services/:slug/invoke
POST /api/v1/invocations/:id/confirm
POST /api/v1/invocations/:id/refund
GET  /api/v1/invocations/:id
GET  /api/v1/metrics
GET  /api/v1/activity
POST /mcp
POST /api/v1/auth/nonce
POST /api/v1/auth/verify
GET  /api/v1/auth/session
POST /api/v1/auth/logout
POST /api/v1/seller/profile
GET  /api/v1/seller/services
GET  /api/v1/seller/metrics
GET  /api/v1/seller/transactions
POST /api/v1/seller/services
POST /api/v1/seller/merchant
POST /api/v1/seller/services/:id/verify-endpoint
POST /api/v1/seller/services/:id/verify-identity
POST /api/v1/seller/services/:id/publish

Seller analytics are available at `/dashboard`; metrics and transaction data are scoped to the authenticated seller and exclude simulations from revenue.

Invocation starts are limited to 30 requests per buyer wallet per minute and four concurrent executions per service. A seller can mark a failed execution as `REFUND_REQUIRED`; actual asset transfer/refund execution remains payment-provider specific and is intentionally not simulated.
```

An invocation must provide a stable `Idempotency-Key`. The initial response is HTTP 402 with authoritative payment terms. Fulfillment cannot transition to execution until the backend verifies the order proof.

The MCP endpoint is available at `/mcp` for autonomous buyer agents. It exposes `search_services`, `get_service`, `get_service_price`, `invoke_service`, `get_invocation_status`, `confirm_invocation`, `get_service_metrics`, and `get_agent_identity`. `invoke_service` returns the same authoritative payment intent as the HTTP API. After QuickPay returns a session ID, the agent supplies it to `confirm_invocation`; fulfillment remains gated by backend verification.

## ERC-8004 identity

The public registration metadata is tracked at `public/agents/agent-commerce-hub.json`. After this file is pushed to the `main` branch, its stable registration URI is:

```text
https://raw.githubusercontent.com/karagozemin/Agent-Commerce-Hub/main/public/agents/agent-commerce-hub.json
```

Verify that the raw URL returns JSON before registering on GOAT mainnet. Use the wallet that should own the hub identity, call `register(string agentURI)` on the GOAT mainnet IdentityRegistry, and keep the returned Agent ID. The registry address is `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.

The hub identity is registered as Agent ID `84` on GOAT mainnet (`eip155:2345:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`).

## Security boundary

Browser payment success is only a UX signal. Before execution, the backend compares order ID, payer, recipient, token contract, amount, and chain. A successful invocation stores input/output hashes and a receipt tied to the transaction hash.
