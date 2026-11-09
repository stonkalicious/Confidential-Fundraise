# Confidential Fundraising

## Optional “Settle $1” demo

After a new soft commitment, its original browser can open **Settle $1 (demo)** on
the raise page. A sponsor opens the same action under that commitment in Sponsor
review, selects the network (testnet by default), enters a receiving NEAR account,
optionally pastes an already-reviewed HTTP(S) link or document hash, and ticks the
demo confirmation. The investor reviews the same immutable details, connects a
NEAR wallet, and ticks their own confirmation before requesting wallet approval.
Only the role and server timestamp are recorded for each confirmation; no terms
or contract text is stored. References are not fetched, uploaded, or parsed.

This sends exactly **1 USDC (1,000,000 base units)** directly on NEAR using
`ft_transfer`. It is not a NEAR Intents swap or a legal investment settlement.
Testnet USDC has no dollar value. Mainnet is an explicit fallback using real
USDC; there is no automatic network switch. The wallet also needs NEAR for gas
and the 1-yoctoNEAR token-transfer deposit. No keys are held by the server.

Token contracts are taken from
[Circle's published addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
Use two different accounts on the selected network. Before sending, fund the
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
soft commitment. Retrying that commitment cannot replace its receipt. Existing
legacy commitments remain unchanged; they do not gain investor authorization
retroactively. Do not clear the original browser's storage before reconciliation.
Private transfer details and hashes are visible on the raise page to that
investor and the sponsor, not in public aggregate API responses. Demo payments
never change the commitment's amount, hard/verified status, or aggregate totals.
Claiming, updating, and soft-committing still require no wallet connection.

Development schema changes are applied with `pnpm --filter @workspace/db run push`
(also run by the post-merge script). Regression coverage:
`pnpm --filter @workspace/api-server exec node --import tsx --test test/demo-settlement.test.mjs`.
The test mocks chain responses; it never signs a transaction or spends tokens.

## Judge walkthrough: NEAR Intents quote

1. Open an approved demo raise and submit a soft commitment using synthetic details only.
2. Open the Sponsor view and enter the sponsor approval code configured in Replit Secrets.
3. Mark the demo commitment hard. The app sends a live `dry: true` request to NEAR Intents 1Click and shows the returned quote fields or the provider's error.
4. Confirm that Progress still displays aggregate totals only.

The quote always uses a fixed synthetic 1 USDC amount and placeholder addresses; it never sends the commitment's identifier or amount. The request asks for `basic` confidentiality. NEAR currently requires an end-user wallet-authenticated session for confidential quote requests; this demo does not sign, so it displays that rejection rather than silently falling back to a public quote. A quote request does not sign or settle a swap.
