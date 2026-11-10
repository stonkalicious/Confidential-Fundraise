# Confidential Fundraising — Powered by NEAR

A hackathon prototype for coordinating fundraising interest without publishing
individual commitments. People or external agents can discover raises, reserve
an unclaimed page, and submit synthetic soft commitments. A founder reviews
individual records behind a shared approval code; public pages show aggregate
totals.

**Demo only. Use synthetic identifiers and amounts.** Page ownership is not
company verification. A recorded commitment, a quote, and a test-token transfer
are different things; none is legal investment settlement.

## What NEAR does here

| Path | What it does | What it does not do |
| --- | --- | --- |
| Fundraising coordination | Stores raises, page claims, commitments, and totals in PostgreSQL. Founder endpoints require the shared approval code. | Does not put commitments onchain or encrypt the database with NEAR. Application operators can access stored data. |
| NEAR Intents 1Click | Uses wallet authentication to request a live `dry: true` quote with `confidentiality: "basic"`, a fixed synthetic 1-USDC amount, and placeholder addresses. | Does not send investor identifiers or actual commitment amounts to NEAR, deposit tokens, execute a swap, or prove completed confidential settlement. |
| Optional NEAR testnet transfer | With separate founder and investor confirmations, asks the investor's wallet to send exactly 1 test USDC using `ft_transfer`. The server verifies the finalized transaction. | Is not an Intents swap, is not confidential onchain, and does not fund the EUR commitment or change its hard/verified status. |

The Intents path uses **mainnet authentication**; there is no Intents testnet.
An already-registered wallet signs an authentication message. A wallet whose
key is not registered must explicitly approve a separate `add_public_key`
transaction on `intents.near`, attaching 1 yoctoNEAR plus network gas. This
registration costs mainnet NEAR even though the subsequent quote is a dry run.
Declining or failing authentication must not downgrade the request to a public
quote.

The optional token-transfer path is **NEAR testnet only**. Test USDC has no
dollar value. See the [wallet walkthrough](artifacts/confidential-fundraise-desk/README.md).

## Run the project

### Requirements

- Node.js 24 and pnpm 10 (workspace preparation used pnpm 10.26.1).
- PostgreSQL reachable through the server's `DATABASE_URL`.
- A server-side `RAISE_APPROVAL_CODE` chosen by the operator for founder access.
- Internet access to NEAR RPC and 1Click for optional wallet features.
- A same-origin reverse proxy: `/api/*` goes to the API; everything else goes
  to the web server. Browser code uses relative API URLs.

Supply credentials through your environment or secret manager; never put actual
values in source files, URLs, screenshots, or this README. The core demo does
not need a wallet, an AI API key, or a 1Click partner key. Do not give a judge
access to a database containing real investor data.

### Prepare a disposable development database

Run from the repository root, with `DATABASE_URL` and `RAISE_APPROVAL_CODE`
already available in the appropriate server shell:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
pnpm run typecheck:libs
```

The schema command changes the selected database: use a new or disposable
development database, not production. Startup inserts missing seeds only; it
does not reset existing claims or commitments. Database initialization failure
stops API startup instead of falling back to a new empty store.

### In the existing Replit workspace

Start the existing managed workflows:

- `artifacts/api-server: API Server`
- `artifacts/confidential-fundraise-desk: web`

Their artifact manifests supply the ports and frontend base path; the existing
shared proxy routes `/api` and `/`. The mockup-sandbox workflow is not needed
for judging. Open the app through Preview, not an individual service port.

### Outside Replit

Use two terminals with the same repository root. The API terminal needs the
server environment described above:

```sh
# Terminal 1
PORT=8080 pnpm --filter @workspace/api-server run dev
```

```sh
# Terminal 2
PORT=23068 BASE_PATH=/ pnpm --filter @workspace/confidential-fundraise-desk run dev
```

Use your existing same-origin reverse proxy, or install
[Caddy](https://caddyserver.com/docs/install) separately and save this
configuration outside the repository as `/tmp/confidential-fundraising.Caddyfile`:

```caddyfile
:3000 {
    handle /api/* {
        reverse_proxy 127.0.0.1:8080
    }
    handle {
        reverse_proxy 127.0.0.1:23068
    }
}
```

```sh
# Terminal 3
caddy run --config /tmp/confidential-fundraising.Caddyfile --adapter caddyfile
```

Open `http://localhost:3000/`. This is a development setup, not a production
deployment recipe. A clean-machine reproduction has not been certified in this
documentation task; record that check before submitting.

## Judge walkthrough: do X → see Y

Use a disposable demo database and synthetic data throughout. Expected results
below describe the implemented flow, not evidence that every live wallet action
has been completed.

1. **Open `/` and choose a raise** → its Progress view shows public EUR totals,
   not investor identifiers or individual amounts. Seeded entries are demo
   listings, not evidence that a company is seeking funding or endorses the app.
2. **Open Prospect and submit `demo-investor-001` with EUR `10000`** → the
   commitment is recorded. The app switches to Founder; enter the operator's
   approval code to see the private record. Keep the code off recordings.
3. **Choose “Mark verified (demo)” on that record** → its hard/verified status
   changes and hard EUR totals increase. This is a server-side demo status,
   not blockchain verification.
4. **Return to Progress, then open the raise in a separate private browser
   window** → only aggregates are visible; no private commitment list appears.
5. **Refresh the page** → saved state remains. For a local persistence check,
   restart the API and reload; the database-backed totals should still match.
6. **Open `/api/raises`, then `/api/raises/ID` using a returned ID** → receive
   public JSON with aggregates. `/api/raises/does-not-exist` returns `404`.
   `/api/raises/ID/private` without founder authorization is denied.

For the agent ownership path, on an **unclaimed approved demo raise**:

- `POST /api/raises/ID/agent-claim` with no body → `201` and
  `{ "claimToken": "...", "raise": { ... } }`. Save the returned token securely:
  it is returned only once. A repeat claim returns `409`.
- `PATCH /api/raises/ID` with `Authorization: Bearer <claimToken>` and JSON
  such as `{"stage":"Seed","status":"paused"}` → updated public summary.
- Only `thesis`, `stage`, `range`, and public `status`
  (`open`, `paused`, `closed`) are editable. The token does not authorize private
  reads, commitment updates, or approval; it does not work on another raise.
- Claim means page ownership only. It is not proof of company identity.
  A pre-existing founder claim also prevents an agent from reserving that page.

New raises submitted through the landing form or `POST /api/raises` go to a
private manual-approval queue; they are not immediately public. Rehearsals should
use a fresh demo raise rather than reset or overwrite existing claims.

For wallet authentication, quote requests, and the optional testnet transfer,
follow the [separate detailed walkthrough](artifacts/confidential-fundraise-desk/README.md).
Do not submit a live transaction just to complete the wallet-free walkthrough.

## Checks and source map

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/confidential-fundraise-desk test
```

API tests require `DATABASE_URL` and use synthetic records, including database
writes. Run them against a disposable development database. Wallet/provider
responses in regression tests are simulated; passing tests do not demonstrate
a successful live quote or real token transfer. This documentation task does
not claim a fresh full-suite or clean-clone pass.

- UI: [artifacts/confidential-fundraise-desk](artifacts/confidential-fundraise-desk)
- API: [artifacts/api-server/src/routes](artifacts/api-server/src/routes)
- API contract: [lib/api-spec/openapi.yaml](lib/api-spec/openapi.yaml)
- Persistent schema: [lib/db/src/schema](lib/db/src/schema)
- Submission drafts and checklist: [docs/hackathon-submission.md](docs/hackathon-submission.md)

The app uses React, Vite, Tailwind CSS, Wouter, TanStack Query, Express,
PostgreSQL/Drizzle, Zod, Orval-generated API helpers, and
`@hot-labs/near-connect` for user-controlled wallets. Package manifests and
`pnpm-lock.yaml` list the remaining dependencies and exact resolved versions.
It does not implement a custom NEAR smart contract or a private-AI model.

## Hackathon baseline and attribution

This repository reuses a Replit pnpm-workspace starter, component scaffolding
(including shadcn/Radix UI), and an existing mockup sandbox. AI coding assistance
was used; boilerplate and third-party libraries are not claimed as original work.
Upstream packages retain their own licenses.

The last commit before the 19 October 2026 announcement is the
[11 September starter baseline](https://github.com/stonkalicious/Confidential-Fundraise/commit/0c05d76b9e518521a819bcdca13cfdf07cc61818).
The first fundraiser-app commit in the available history is dated 20 October
2026. Review the
[baseline-to-main diff](https://github.com/stonkalicious/Confidential-Fundraise/compare/0c05d76b9e518521a819bcdca13cfdf07cc61818...main)
or run:

```sh
git diff 0c05d76b9e518521a819bcdca13cfdf07cc61818 HEAD -- artifacts/confidential-fundraise-desk artifacts/api-server lib
```

These links point at the configured repository; its public visibility and latest
push are not verified here. Before submission, pin the final judging revision
on a dedicated submission branch or approved tags and link its exact comparison.
No branch, tag, push, visibility change, or submission was performed by this task.

## License

[MIT](LICENSE), approved by the project owner. This does not override licenses
on third-party code or assets.
