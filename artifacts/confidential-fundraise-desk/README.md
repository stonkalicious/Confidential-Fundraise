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

## NEAR Intents availability

NEAR Intents 1Click has no testnet. To keep this demo testnet-only, the app
does not authenticate NEAR Intents wallets or request quotes; those API
endpoints return HTTP 410 without contacting 1Click. The separate optional
`ft_transfer` above uses NEAR testnet and is not an Intents swap. No live
confidential quote or mainnet wallet interaction is claimed.
