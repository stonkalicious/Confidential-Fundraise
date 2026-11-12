# Agent Raised

See the [root README](../../README.md) for setup, the wallet-free judge
walkthrough, privacy boundaries, and baseline disclosure. The walkthroughs
below describe expected behavior; they are not a record of successful live
wallet transactions.

## Optional “Settle $1” demo

After a new soft commitment, the founder opens **Settle $1 (demo)** under that
commitment in Founder review, enters a receiving NEAR testnet account, optionally
pastes an already-reviewed HTTP(S) link or document hash, and ticks the demo
confirmation. The founder can then create a private investor link to send to the
investor. The investor opens it in their own browser, reviews the same immutable
details, connects a NEAR wallet, and ticks their own confirmation before
requesting wallet approval. Only the role and server timestamp are recorded for
each confirmation; no terms or contract text is stored. References are not
fetched, uploaded, or parsed.

This sends exactly **1 USDC (1,000,000 base units)** directly on NEAR using
`ft_transfer`. It is not a NEAR Intents swap or a legal investment settlement.
Testnet USDC has no dollar value. This transfer flow is **testnet-only**;
mainnet sends are blocked. The wallet also needs test NEAR for gas and the
1-yoctoNEAR token-transfer deposit. No keys are held by the server. The transfer
is publicly visible on NEAR testnet, not confidential settlement.

Token contracts are taken from
[Circle's published addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
Use two different NEAR testnet accounts. Before sending, fund the
investor with at least 1 test USDC and test NEAR, and register the receiver with
the USDC contract (`storage_deposit`) using a wallet or token tooling. The app
checks registration and balance and does not silently add a storage payment.
Circle's [test-token faucet](https://faucet.circle.com/) and NEAR testnet wallet
tools can be used where the relevant network is supported.

The server checks both confirmations, issues a single-use send reservation, and
independently verifies the final transaction, token contract, sender, receiver,
exact amount, attached deposit, unique memo, successful receipts, and USDC event.
It only displays a successful transaction hash after those checks. Failed or
uncertain wallet attempts must not be resent automatically: check the wallet
and use **Check demo transaction** with its hash. A prepared transfer remains
reserved after a wallet error or rejection; this intentionally requires
reconciliation rather than risking a duplicate payment.

Investor access uses an unguessable browser receipt minted with the original
soft commitment, or a separate founder-issued link token scoped to that one
commitment. Link tokens expire after seven days; creating a replacement
invalidates the previous link. The server stores only the token hash. The token
travels in the URL fragment, is removed from the address bar when opened, and is
saved in that investor browser for settlement access. Anyone with the link can
access that commitment's demo settlement, so share it privately. Retrying a
commitment cannot replace its original receipt. Existing legacy commitments
remain unchanged; they do not gain investor authorization retroactively. Keep
the investor browser storage until reconciliation is complete.
Private transfer details and hashes are visible on the raise page to that
investor and the founder, not in public aggregate API responses. Demo payments
never change the commitment's amount, hard/verified status, or aggregate totals.
Claiming, updating, and soft-committing still require no wallet connection.
After confirmation, public progress can show an anonymous confirmed-testnet-
transfer count. Hiding a hash in this app does not hide it on the public chain.

Development schema changes are applied with `pnpm --filter @workspace/db run push`
(also run by the post-merge script). Regression coverage:
`pnpm --filter @workspace/api-server exec node --import tsx --test test/demo-settlement.test.mjs`.
The test mocks chain responses; it never signs a transaction or spends tokens.

## Judge walkthrough: NEAR Intents quote

1. Open an approved demo raise and submit a soft commitment using synthetic
   details only. This does not require a wallet.
2. Open Founder and enter the configured founder approval code. Keep it off
   recordings.
3. Mark the demo commitment hard and select it for a quote. The app requires a
   NEAR wallet session before requesting the confidential quote.
4. Choose **Authenticate with NEAR wallet** and use a user-controlled NEAR
   mainnet account. A registered wallet signs an authentication message. This
   is not a token transfer.
5. If the connected key is not registered on `intents.near`, review the separate
   registration prompt. **Approve and register key** asks the wallet to call
   `add_public_key` on mainnet, with 1 yoctoNEAR and network gas. This has a real
   mainnet cost. Only proceed with explicit owner approval; declining keeps
   confidential quotes blocked.
6. Request the confidential dry-run quote. An accepted provider response shows
   quote fields; a rejection or outage shows an error instead. Do not describe
   an error screen as a successful quote.
7. Return to Progress → aggregate totals remain the only public commitment
   information. A quote alone does not fund a commitment or settle a swap.

The quote always uses a fixed synthetic 1-USDC amount and placeholder addresses;
it never sends the commitment's identifier or amount. The request asks for
`basic` confidentiality. The app signs a wallet authentication message, exchanges
the proof for a provider session, and keeps the refresh credential in an HttpOnly
cookie. It can refresh a returning session without signing again while the
provider permits it. It never silently falls back to a public quote.

NEAR Intents has no testnet: this is a mainnet API **dry run**, distinct from
the testnet `ft_transfer` above. Successful mocked regression tests do not prove
a successful live confidential quote or funded-wallet transfer. See the
[submission checklist](../../docs/hackathon-submission.md) for evidence still
to collect.
