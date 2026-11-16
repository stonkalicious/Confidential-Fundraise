# Agent Raised MCP server

Agent Raised provides a hosted MCP endpoint for Claude and other compatible
clients, plus a local stdio server for development.

## Hosted server

The public remote MCP endpoint is:

```text
https://agentraised.com/api/mcp
```

It exposes four tools:

1. `list_raises` — read public raises and filter by stage, overlapping ticket
   range, or keyword.
2. `get_raise` — read one raise's public details.
3. `claim_or_update_raise` — submit a new raise for manual approval, claim an
   approved page, or update its public fields with the per-raise token.
4. `soft_commit` — record a synthetic, non-binding commitment without returning
   its identifier or amount.

The hosted endpoint has no sign-in. Its reads return public raise information
and aggregates only; it never reads individual commitments or founder contact
details. New raises remain pending until manually approved. Page claims do not
verify a founder or company. The hosted server does not expose testnet settlement
tools.

In Claude, open **Customize → Connectors → Add custom connector**, enter the URL
above, and choose **No sign in**. Enable Agent Raised for a conversation, then
ask Claude to find or read public raises. Founders can ask it to submit a raise;
the result will say it is pending approval. Investors can ask it to record a
synthetic soft commitment. Do not use real investor contact details or
confidential business information.

## Local stdio server

The local server communicates over stdio and calls the existing Agent Raised
HTTP API. It exposes exactly four tools:

1. `list_raises` — reads public raise summaries and filters by stage (case-insensitive
   exact match), overlapping ticket range, and case-insensitive keyword.
2. `claim_or_update_raise` — creates a raise for manual approval, claims an
   approved raise and returns its one-time claim token, or updates that raise's
   public thesis, stage, range, or status using the token. Claiming does not
   verify a founder or company.
3. `soft_commit` — records a synthetic, non-binding whole-dollar commitment.
   Its result is only `Soft commitment recorded.` It never returns the
   investor identifier, amount, commitment ID, or receipt.
4. `settle_test_usdc` — optionally coordinates the existing 1 test USDC flow.
   Founder and investor confirmations are separate, preparation returns
   wallet instructions only, and a signed transaction hash is reported only
   after the API verifies it on NEAR testnet.

The tools do not read individual commitments. Never use real investor data,
contact details, or confidential business information with this hackathon demo.

## Build and run

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build:mcp
pnpm --filter @workspace/api-server run mcp
```

The final command runs the stdio server in the foreground. Close it when the MCP
client is finished. The API should already be reachable. The default API URL is
`http://127.0.0.1:8080/api`; set `AGENT_RAISED_API_BASE_URL` if using another
base URL, for example `https://agentraised.com/api`.

`RAISE_APPROVAL_CODE` is optional and is read only from the MCP process
environment. Set it locally if the founder must configure a testnet transfer;
never paste it into a tool call or commit it to the repository. Without it,
public listing, raise creation/claim/update, soft commitments, and investor-side
steps remain available, but `founder_confirm` is unavailable.

### Claude Desktop

Open **Settings → Developer → Edit Config**. Add an `agent-raised` entry to
`mcpServers`, keeping any existing servers. The config file is:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "agent-raised": {
      "command": "node",
      "args": ["/absolute/path/to/AgentRaised/artifacts/api-server/dist/mcp.mjs"],
      "env": {
        "AGENT_RAISED_API_BASE_URL": "https://agentraised.com/api",
        "RAISE_APPROVAL_CODE": "<set locally; omit if not needed>"
      }
    }
  }
}
```

Replace the executable and repository paths for your machine. Keep this config
in your user profile, not in the shared repository, if it contains the founder
approval code. Restart Claude Desktop after saving.

### Cursor

Create or edit `.cursor/mcp.json` in the project, or use Cursor's user-level MCP
configuration. Add the same server entry:

```json
{
  "mcpServers": {
    "agent-raised": {
      "command": "node",
      "args": ["/absolute/path/to/AgentRaised/artifacts/api-server/dist/mcp.mjs"],
      "env": {
        "AGENT_RAISED_API_BASE_URL": "https://agentraised.com/api",
        "RAISE_APPROVAL_CODE": "<set locally; omit if not needed>"
      }
    }
  }
}
```

Replace the absolute paths and keep any existing `mcpServers` entries. Do not
commit a config containing the founder approval code. Restart Cursor and enable
the server from its MCP settings if it is not connected automatically.

## Tool examples

### `list_raises`

Pass any subset of filters. A ticket range matches when it overlaps the raise's
published range.

```json
{
  "stage": "seed",
  "minRange": 100000,
  "maxRange": 500000,
  "keyword": "privacy"
}
```

### `claim_or_update_raise`

Create a pending raise:

```json
{
  "action": "create",
  "name": "Synthetic demo raise",
  "thesis": "A sufficiently detailed synthetic example thesis.",
  "stage": "Seed",
  "range": { "min": 100000, "max": 500000 }
}
```

To reserve an already-approved, unclaimed page, call the same tool with
`{"action":"claim","raiseId":"<public-raise-id>"}`. The returned claim token is
shown once; store it securely. Update only public fields with, for example:

```json
{
  "action": "update",
  "raiseId": "<public-raise-id>",
  "claimToken": "<one-time-token>",
  "stage": "Seed",
  "status": "paused"
}
```

### `soft_commit`

Use synthetic values and a caller-generated opaque ID. Keep that ID available
for optional settlement; it is intentionally not returned by the tool.

```json
{
  "raiseId": "<public-raise-id>",
  "commitmentId": "demo-commit-001",
  "identifier": "synthetic-investor-alias",
  "amount": 10000
}
```

### `settle_test_usdc`

This tool only coordinates the separate 1 test USDC transfer. It does not send
funds, use the displayed commitment amount, or change USD totals. After a soft
commitment in the same running MCP process, the founder records their testnet
receiver and explicit confirmation:

```json
{
  "action": "founder_confirm",
  "raiseId": "<public-raise-id>",
  "commitmentId": "demo-commit-001",
  "receiverAccount": "founder.testnet",
  "confirmed": true
}
```

The investor then separately confirms with a testnet account:

```json
{
  "action": "investor_confirm",
  "raiseId": "<public-raise-id>",
  "commitmentId": "demo-commit-001",
  "signerAccount": "investor.testnet",
  "confirmed": true
}
```

Next call `settle_test_usdc` with `{"action":"prepare", ...}`. It returns the
testnet wallet method and arguments for the investor to review and sign outside
the MCP server. Only after the user signs and receives a transaction hash should
the agent call `{"action":"verify","raiseId":"...","commitmentId":"...","transactionHash":"..."}`.
The API must verify the transaction on testnet before the tool reports success.
Use `{"action":"status", ...}` to check role confirmations and progress.

The MCP process creates and holds the investor receipt in memory, never returns
it, and does not persist it to disk. Keep that process running through the
settlement flow. If it stops before completion, the agent receipt is lost; start
a new synthetic commitment with a new ID rather than retrying an old one.
Existing commitments created in a browser are not available to this MCP session.
No tool sends a transaction or stores wallet keys.

## Verification

```sh
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/api-server run build:mcp
```

The MCP tests use a local fake API and verify both stdio and hosted stateless
HTTP transports, including tool inventories, public filters, claim-token
scoping, pending raise submissions, and private commitment responses. Local
stdio tests also cover the optional testnet confirmation sequence, no-send
wallet handoff, onchain-verification gate, and independence from the API
process. They do not send a real transfer or prove a live wallet connection.
