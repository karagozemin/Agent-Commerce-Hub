# Architecture

Agent Commerce Hub is a payment-gated service marketplace. Its central invariant is:

> A service result is released only after the server verifies the payment proof against the invocation terms.

## System context

~~~mermaid
flowchart LR
  Buyer[Human buyer] --> Web[Next.js web app]
  Agent[Autonomous agent] --> MCP[MCP Streamable HTTP]
  Buyer --> REST[REST API]
  Web --> REST
  REST --> Core[Invocation service]
  MCP --> Core
  Core --> Catalog[Catalog]
  Core --> Payments[Payment provider router]
  Core --> Executor[Service executor]
  Payments --> Goat[GOAT Flow / QuickPay]
  Executor --> RPC[GOAT mainnet RPC]
  Executor --> SellerEndpoint[Verified seller HTTPS endpoint]
  Catalog --> Store[(Memory or PostgreSQL)]
~~~

The web app, REST handlers, and MCP server are transport layers. The invocation service owns business sequencing; payment providers and executors are infrastructure behind that sequence.

## Runtime boundaries

~~~text
src/app                         Presentation and HTTP transport
  pages + components            Marketplace, seller UI, invocation UX
  api/v1 + mcp                  REST and MCP route handlers

src/server                      Application services and infrastructure
  catalog                       Published projection and purchasability filter
  invocation-service            Idempotency, payment gating, execution, receipts
  payment                       Mock, GOAT DIRECT, QuickPay, routing provider
  seller + auth                 Sessions, drafts, verification, publish gates
  executor                      First-party and verified external execution
  service-endpoint-verifier     SSRF-resistant endpoint probe and schema checks

src/db                          Persistence adapters
  schema                        Drizzle table definitions
  seed                          Local seed catalog for PostgreSQL development
  repository                    Memory and PostgreSQL repositories

src/domain                      Pure contracts and state transitions
  invocation-machine            Legal status transitions
  types                         Shared records and payment terms
  hash                          Canonical payload hashing
~~~

## Invocation sequence

~~~mermaid
sequenceDiagram
  participant B as Buyer / Agent
  participant T as REST or MCP
  participant I as InvocationService
  participant C as Catalog
  participant P as Payment provider
  participant G as GOAT Flow / QuickPay
  participant E as Executor
  participant S as Receipt store

  B->>T: invoke(slug, input, Idempotency-Key)
  T->>I: validated request
  I->>C: find published + purchasable service
  I->>I: validate input, rate limit, reserve idempotency
  I->>P: create order
  P->>G: create DIRECT order or load QuickPay product
  G-->>P: authoritative payment terms
  P-->>I: PaymentOrder
  I-->>B: 402 + payment terms
  B->>G: pay / complete checkout
  B->>T: confirm(invocation, proof or session)
  T->>I: confirmation
  I->>P: verify order/session and merchant proof
  P->>G: read status + proof
  G-->>P: verified proof
  I->>I: compare payer, recipient, token, amount, chain
  I->>E: execute only after proof passes
  E-->>I: live result
  I->>I: hash input/output and build receipt
  I->>S: persist success + receipt
  I-->>B: result + receipt
~~~

### State machine

~~~mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> PAYMENT_REQUIRED: payment order created
  PAYMENT_REQUIRED --> PAYMENT_SUBMITTED: buyer confirms payment
  PAYMENT_SUBMITTED --> PAYMENT_CONFIRMED: backend proof passes
  PAYMENT_SUBMITTED --> PAYMENT_FAILED: provider rejects proof
  PAYMENT_REQUIRED --> PAYMENT_EXPIRED: order expires
  PAYMENT_CONFIRMED --> EXECUTING
  EXECUTING --> SUCCEEDED: executor returns valid result
  EXECUTING --> EXECUTION_FAILED: executor fails
  EXECUTION_FAILED --> REFUND_REQUIRED: seller/provider marks failure
  REFUND_REQUIRED --> REFUNDED: provider-specific refund
~~~

PAYMENT_REQUIRED is not proof of payment. A browser callback, wallet popup, or client-provided transaction hash cannot advance the state by itself.

## Payment routing

~~~mermaid
flowchart TD
  Start[Create invocation] --> Route{Service route}
  Route -->|wallet-lens, first-party mainnet| Quick[QuickPay product provider]
  Route -->|verified external seller| Direct[Seller GOAT Flow DIRECT provider]
  Route -->|local mock mode| Mock[Mock provider]
  Quick --> Manifest[Read live product manifest]
  Manifest --> Session[Hosted checkout session]
  Session --> ProofA[Verify QuickPay session]
  ProofA --> MerchantProof[Verify GOAT merchant order proof]
  Direct --> MerchantConfig[Load encrypted seller credentials]
  MerchantConfig --> ProofB[Verify DIRECT order proof]
  Mock --> Sim[Simulation proof; no funds]
  MerchantProof --> Gate[Invocation proof gate]
  ProofB --> Gate
  Sim --> Gate
~~~

The payment router is in src/server/payment/routing-provider.ts. goat-flow-provider.ts owns DIRECT orders; quickpay-product-provider.ts owns the fixed Wallet Analysis product; mock-provider.ts is development-only.

## Catalog and purchasability

~~~mermaid
flowchart LR
  Env{DATA_STORE}
  Env -->|memory| Seed[src/data/services.ts]
  Env -->|postgres| DB[(PostgreSQL services)]
  Seed --> Projection[Runtime service projection]
  DB --> Projection
  Projection --> Filter{PAYMENT_PROVIDER=goat-flow?}
  Filter -->|no| All[All seed/published services]
  Filter -->|yes| Live[Wallet Analysis + verified external services]
~~~

In mock mode the seed catalog supports UI and state-machine development. In goat-flow mode a service must be the live first-party Wallet Analysis QuickPay product or a PostgreSQL service with a seller ID, HTTPS endpoint, verified ERC-8004 identity, and published status.

## Seller publishing pipeline

~~~mermaid
flowchart LR
  Wallet[Signed wallet session] --> Draft[Create draft]
  Draft --> Endpoint[Verify HTTPS endpoint + JSON schemas]
  Endpoint --> Identity[Verify ERC-8004 owner, wallet, URI]
  Identity --> Merchant[Verify GOAT Flow DIRECT merchant]
  Merchant --> Fresh[Check endpoint freshness]
  Fresh --> Published[Published + purchasable]
~~~

The receiving wallet is copied from, and checked against, the authenticated seller wallet. Merchant credentials are encrypted with AES-256-GCM. Every gate is rechecked server-side.

## Wallet Analysis execution

Wallet Analysis is first-party but its result is live data, not a canned response:

~~~mermaid
sequenceDiagram
  participant E as Executor
  participant R as GOAT mainnet RPC
  E->>R: eth_getBalance(address)
  E->>R: eth_getTransactionCount(address)
  E->>R: eth_getCode(address)
  E->>R: eth_blockNumber
  R-->>E: balance, nonce, code, observed block
  E-->>E: classify account + build summary
~~~

External seller execution follows the same payment gate but calls the seller's verified HTTPS endpoint and validates the response against its stored output schema.

## Data model

~~~mermaid
erDiagram
  USERS ||--o| SELLERS : owns
  USERS ||--o{ SESSIONS : authenticates
  SELLERS ||--o{ SERVICES : publishes
  SELLERS ||--o| MERCHANT_CONFIGS : configures
  SERVICES ||--o| AGENT_IDENTITIES : links
  SERVICES ||--o{ INVOCATIONS : receives
  USERS ||--o{ AUTH_CHALLENGES : requests

  USERS {
    string id PK
    string wallet_address UK
  }
  SELLERS {
    string id PK
    string user_id FK
    string display_name
    string status
  }
  SERVICES {
    string id PK
    string seller_id FK
    string slug UK
    json input_schema
    json output_schema
    string status
    string receiving_wallet
  }
  AGENT_IDENTITIES {
    string id PK
    string service_id UK
    string agent_id
    string agent_uri
    datetime verified_at
  }
  MERCHANT_CONFIGS {
    string id PK
    string seller_id UK
    string encrypted_api_key
    string encrypted_api_secret
    datetime verified_at
  }
  INVOCATIONS {
    string id PK
    string service_id FK
    string buyer_wallet
    string status
    json payment_order
    json payment_proof
    json receipt
  }
  SESSIONS {
    string id PK
    string user_id FK
    string wallet_address
    datetime expires_at
  }
  AUTH_CHALLENGES {
    string id PK
    string wallet_address
    string message
    datetime expires_at
    datetime consumed_at
  }
~~~

The schema lives in src/db/schema.ts. Repository implementations keep application code independent from the memory/PostgreSQL choice.

## Failure boundaries

| Boundary | Failure behavior |
| --- | --- |
| Catalog unavailable | Request fails; no payment order is created |
| Payment order creation fails | Invocation remains unfulfilled; no execution |
| Payment proof mismatch | Confirmation is rejected; no execution |
| Seller endpoint fails after payment | Invocation becomes EXECUTION_FAILED; refund handling is provider-specific |
| RPC snapshot unavailable | Wallet Analysis fails; no fabricated result is returned |
| Duplicate idempotency key | Original invocation is returned if payload matches; mismatch is rejected |

## Deployment shape

~~~text
Browser / Agent
      |
      v
Next.js application (server + route handlers)
      |\
      | \---- PostgreSQL (persistent catalog, auth, invocations, receipts)
      |
      |------ GOAT Flow API / QuickPay (payment creation + proof)
      |
      |------ GOAT RPC (Wallet Analysis + transaction tracking)
      |
      \------ Seller HTTPS endpoints (verified, public, JSON contracts)
~~~

The app can run as a single Next.js deployment. Secrets stay server-side; browser code receives only payment terms, public catalog data, and short-lived UX state.

## Change guide

- Add pages or routes in src/app.
- Add business sequencing in src/server, not in a route handler or client component.
- Add a payment integration behind PaymentProvider and route it explicitly.
- Change persistence through src/db/schema.ts, generate a migration, then update repositories.
- Add domain tests before changing invocation transitions.
- Keep demo seed services in mock mode; never present them as production merchants.
