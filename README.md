<div align="center">
  <img src="public/ach-logo.png" alt="Agent Commerce Hub" width="200" />
  <h1>Agent Commerce Hub</h1>
  <p>Verifiable, pay-per-call commerce for AI services on GOAT Network.</p>
  <p><a href="ARCHITECTURE.md">Architecture</a> · <a href="#quick-start">Quick start</a> · <a href="#api-surface">API surface</a> · <a href="#security-model">Security model</a></p>
</div>

Agent Commerce Hub is a marketplace and machine-facing gateway for paid AI capabilities. Buyers discover a service, receive authoritative payment terms, pay through GOAT Flow/x402, and get a result only after the backend verifies the payment proof.

## Operating modes

| Mode | Purpose | Catalog | Payment |
| --- | --- | --- | --- |
| `memory` + `mock` | Local UI and state-machine development | Seed catalog | Simulated; no funds move |
| `postgres` + `goat-flow` | Production-like operation | Published, verified services only | GOAT Flow DIRECT or live Wallet Analysis QuickPay |

In real-payment mode, demo seed services are hidden. The live first-party product is **Wallet Analysis** at `0.10 USDC `; external seller services appear only after endpoint, ERC-8004 identity, and merchant verification.

For boundaries, state transitions, payment flows, data model, and deployment shape, read [ARCHITECTURE.md](ARCHITECTURE.md).

## What is here

- Human marketplace at `/`, `/market`, and `/service/:slug`.
- REST and MCP Streamable HTTP discovery and invocation.
- Idempotent invocation lifecycle with authoritative `402 Payment Required` terms.
- GOAT Flow DIRECT proof verification and QuickPay session verification.
- Live Wallet Analysis execution from GOAT mainnet JSON-RPC.
- Seller wallet authentication, endpoint verification, ERC-8004 checks, encrypted merchant credentials, and publish gates.
- PostgreSQL persistence for sellers, services, identities, invocations, payments, receipts, and sessions.
- Public metrics excluding simulated and internal activity.
- SSRF-resistant endpoint verification with JSON Schema validation.

## Quick start

~~~bash
npm install
cp .env.example .env.local
npm run dev
~~~

Open [http://localhost:3000](http://localhost:3000). Defaults are `DATA_STORE=memory` and `PAYMENT_PROVIDER=mock`; no funds move in this mode.

To use persistent local storage:

~~~bash
docker compose up -d postgres
npm run db:migrate
~~~

Then set:

~~~dotenv
DATA_STORE=postgres
DATABASE_URL=postgresql://agenthub:agenthub@localhost:5432/agenthub
~~~

Do not switch to `postgres` until the database is reachable. If the server cannot connect, catalog seeding fails at startup.

Run checks:

~~~bash
npm run typecheck
npm run lint
npm test
~~~

## Production payment setup

Keep all payment credentials server-side:

~~~dotenv
DATA_STORE=postgres
PAYMENT_PROVIDER=goat-flow
GOATX402_API_URL=https://flow-api.goat.network
GOATX402_API_KEY=...
GOATX402_API_SECRET=...
GOATX402_RECEIVING_WALLET=0x...
GOAT_CHAIN_ID=2345
GOAT_RPC_URL=https://rpc.goat.network
GOAT_TRACKING_RPC_URL=https://rpc.ankr.com/goat_mainnet
GOAT_EXPLORER_URL=https://explorer.goat.network
GOAT_QUICKPAY_ORIGIN=https://flow-quickpay.goat.network
GOAT_QUICKPAY_MERCHANT_ID=agentcommercehub
GOAT_QUICKPAY_PRODUCT_KEY=wallet-analysis
~~~

The first-party receiving wallet must match the merchant DIRECT route. Live QuickPay references:

- [Agent instructions](https://flow-quickpay.goat.network/quickpay/agentcommercehub/agent.md)
- [Machine-readable manifest](https://flow-quickpay.goat.network/quickpay/agentcommercehub/manifest.json)

Before accepting seller credentials:

~~~bash
openssl rand -base64 32
~~~

Set the result as `CREDENTIAL_ENCRYPTION_KEY`.

## Seller publishing flow

Services remain drafts until all gates pass:

1. **Endpoint**: HTTPS endpoint returns JSON for the declared test input. Public DNS, no redirects/private IPs, valid JSON, response-size and timeout limits.
2. **Identity**: ERC-8004 `ownerOf`, `getAgentWallet`, and `tokenURI` match the authenticated wallet and metadata.
3. **Merchant**: GOAT Flow DIRECT route matches chain, token, and receiving wallet. Verification credentials are encrypted.
4. **Freshness**: Endpoint verification is recent and healthy.

Only published services enter the production PostgreSQL catalog used by the marketplace, REST API, and MCP server.

## API surface

### Public discovery and execution

~~~text
GET  /api/v1/services
GET  /api/v1/services/:slug
GET  /api/v1/services/:slug/health
GET  /api/v1/services/:slug/metrics
POST /api/v1/services/:slug/invoke
GET  /api/v1/invocations/:id
POST /api/v1/invocations/:id/confirm
POST /api/v1/invocations/:id/refund
GET  /api/v1/activity
GET  /api/v1/metrics
POST /mcp
~~~

Every invocation requires a stable `Idempotency-Key`. The first response returns `402 Payment Required` with authoritative terms. Execution is impossible until the backend verifies payer, recipient, token, amount, chain, order/session, and transaction proof.

### Seller and authentication

~~~text
POST /api/v1/auth/nonce
POST /api/v1/auth/verify
GET  /api/v1/auth/session
POST /api/v1/auth/logout
POST /api/v1/seller/profile
GET  /api/v1/seller/services
POST /api/v1/seller/services
POST /api/v1/seller/merchant
POST /api/v1/seller/services/:id/verify-endpoint
POST /api/v1/seller/services/:id/verify-identity
POST /api/v1/seller/services/:id/publish
GET  /api/v1/seller/metrics
GET  /api/v1/seller/transactions
~~~

MCP tools include `search_services`, `get_service`, `get_service_price`, `invoke_service`, `get_invocation_status`, `confirm_invocation`, `get_service_metrics`, and `get_agent_identity`.

## Security model

- Wallet login uses a five-minute, single-use signed challenge.
- Only a SHA-256 digest of the session token is stored; the raw token is an `HttpOnly`, `SameSite=Lax` cookie.
- Seller receiving wallets are bound to the authenticated wallet and checked server-side.
- Merchant secrets use AES-256-GCM and are never returned to clients.
- Endpoint verification blocks SSRF targets, redirects, private IPs, oversized responses, and slow responses.
- Payment proof is checked against the original invocation terms before execution.
- Input/output hashes are stored in the receipt.
- Invocation starts are rate-limited; executions are concurrency-limited per service.
- Simulations and internal wallets are excluded from external metrics.

## Repository map

~~~text
src/app/                  Next.js pages, layouts, API route handlers
src/components/           Marketplace, seller onboarding, invocation UI
src/domain/                State machine, hashes, shared domain types
src/server/                Catalog, invocation, auth, seller, payments, MCP
src/db/                    Drizzle schema, client, seed, repositories
src/data/services.ts       Seed manifests for memory/mock development
public/ach-logo.png        Product mark used by the app and README
ARCHITECTURE.md            System design and flow diagrams
~~~

## Documentation path

1. [ARCHITECTURE.md](ARCHITECTURE.md) — system boundaries and runtime flows.
2. [`.env.example`](.env.example) — configuration and safe defaults.
3. [Seller onboarding](src/components/seller-onboarding.tsx) — publishing workflow.
4. [Invocation service](src/server/invocation-service.ts) — payment-gated execution.
5. [Payment providers](src/server/payment/) — mock, DIRECT, routing, and QuickPay.

## ERC-8004 hub identity

Metadata: [public/agents/agent-commerce-hub.json](public/agents/agent-commerce-hub.json).

~~~text
https://raw.githubusercontent.com/karagozemin/Agent-Commerce-Hub/main/public/agents/agent-commerce-hub.json
~~~

Current hub identity: Agent ID `84` on GOAT mainnet (`eip155:2345:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`).

## Development notes

- Seed metrics are intentionally zero; fabricated activity is never shown as real usage.
- Generate migrations only after changing `src/db/schema.ts`; apply committed migrations with `npm run db:migrate`.
- A failed execution can become `REFUND_REQUIRED`; actual refunds remain provider-specific.
- Production execution uses live GOAT data for Wallet Analysis and verified seller HTTPS endpoints for external services.
