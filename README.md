# Agent Commerce Hub

Agent Commerce Hub is a marketplace where AI services are discovered, paid per call through GOAT Flow/x402, and fulfilled only after trusted backend payment confirmation.

## Current vertical slice

- Searchable service marketplace and machine-readable manifests
- Service detail, schemas, pricing, and ERC-8004 identity metadata
- Idempotent `402 Payment Required` invocation flow
- Mock payment adapter for local development
- GOAT Flow DIRECT order and backend proof adapter
- Payment-to-fulfillment state machine with receipt hashing
- Public metrics that exclude simulations and internal activity
- PostgreSQL schema for sellers, identities, services, invocations, and internal wallets

The seed service metrics are intentionally zero. The UI does not present fabricated transaction activity.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The default `PAYMENT_PROVIDER=mock` exercises the full invocation state machine without sending funds.

For the optional PostgreSQL service:

```bash
docker compose up -d postgres
npm run db:generate
npm run db:migrate
```

The current vertical slice uses the in-memory repository so it can run immediately. The Drizzle schema defines the persistent production model and is the next repository adapter.

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
```

An invocation must provide a stable `Idempotency-Key`. The initial response is HTTP 402 with authoritative payment terms. Fulfillment cannot transition to execution until the backend verifies the order proof.

## Security boundary

Browser payment success is only a UX signal. Before execution, the backend compares order ID, payer, recipient, token contract, amount, and chain. A successful invocation stores input/output hashes and a receipt tied to the transaction hash.
