# Confidential Fundraise Desk

## Judge walkthrough: NEAR Intents quote

1. Open an approved demo raise and submit a soft commitment using synthetic details only.
2. Open the Sponsor view and enter the sponsor approval code configured in Replit Secrets.
3. Mark the demo commitment hard. The app sends a live `dry: true` request to NEAR Intents 1Click and shows the returned quote fields or the provider's error.
4. Confirm that Progress still displays aggregate totals only.

The quote always uses a fixed synthetic 1 USDC amount and placeholder addresses; it never sends the commitment's identifier or amount. The request asks for `basic` confidentiality. NEAR currently requires an end-user wallet-authenticated session for confidential quote requests; this demo does not sign, so it displays that rejection rather than silently falling back to a public quote. A quote request does not sign or settle a swap.
