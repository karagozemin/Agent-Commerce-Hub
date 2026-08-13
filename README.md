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
- Public metrics that exclude simulations and internal activity
- PostgreSQL repository for auth, sellers, services, invocations, and receipts

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

New seller services remain `draft` until endpoint health, schema response, payment configuration, and ERC-8004 ownership have been verified. Draft endpoints are restricted to public HTTPS hosts and checked against private-network DNS resolution.

## GOAT Flow configuration

Switch to the production payment adapter only after merchant configuration is complete:

```bash
PAYMENT_PROVIDER=goat-flow
GOATX402_API_URL=https://flow-api.testnet3.goat.network
GOATX402_API_KEY=...
GOATX402_API_SECRET=...
GOAT_CHAIN_ID=48816
```

For mainnet use chain ID `2345`, `https://flow-api.goat.network`, and the matching merchant/token/receiving-address configuration. Never expose merchant credentials in browser environment variables.

## API

```text
GET  /api/v1/services
GET  /api/v1/services/:slug
POST /api/v1/services/:slug/invoke
POST /api/v1/invocations/:id/confirm
GET  /api/v1/invocations/:id
GET  /api/v1/metrics
GET  /api/v1/activity
POST /api/v1/auth/nonce
POST /api/v1/auth/verify
GET  /api/v1/auth/session
POST /api/v1/auth/logout
POST /api/v1/seller/profile
GET  /api/v1/seller/services
POST /api/v1/seller/services
```

An invocation must provide a stable `Idempotency-Key`. The initial response is HTTP 402 with authoritative payment terms. Fulfillment cannot transition to execution until the backend verifies the order proof.

## Security boundary

Browser payment success is only a UX signal. Before execution, the backend compares order ID, payer, recipient, token contract, amount, and chain. A successful invocation stores input/output hashes and a receipt tied to the transaction hash.
