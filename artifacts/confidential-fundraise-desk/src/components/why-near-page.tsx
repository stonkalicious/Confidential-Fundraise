import { useEffect } from 'react';
import { Link } from 'wouter';
import SiteHeader from '@/components/site-header';

export default function WhyNearPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const title = 'Why use NEAR Intents? | Agent Raised - Powered by NEAR';
    const description = 'Learn how NEAR Intents can support cross-chain payments. This testnet-only demo does not request live Intents quotes.';
    const previousMeta = [
      ['meta[name="description"]', description],
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', description],
      ['meta[name="twitter:title"]', title],
      ['meta[name="twitter:description"]', description],
    ].map(([selector, content]) => {
      const element = document.querySelector(selector);
      const previousContent = element?.getAttribute('content') ?? null;
      element?.setAttribute('content', content);
      return { element, previousContent };
    });
    document.title = title;
    return () => {
      document.title = previousTitle;
      for (const { element, previousContent } of previousMeta) {
        if (previousContent === null) element?.removeAttribute('content');
        else element?.setAttribute('content', previousContent);
      }
    };
  }, []);

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="frame">
        <Link className="raise-back-link" href="/">← Active raises</Link>
        <article className="view-content roadmap-panel" data-testid="why-near-page">
          <div className="thesis-copy">
            <h1 className="roadmap-title">Why use NEAR Intents?</h1>

            <h2>A practical example</h2>
            <p>
              An investor holds USDC on Ethereum. Privacy Token Fund wants to receive USDC on Arbitrum.
            </p>
            <ol className="near-info-steps">
              <li>
                <h3>Record the interest</h3>
                <p>
                  The investor adds a soft commitment. This records interest; it does not send money.
                </p>
              </li>
              <li>
                <h3>Ask what the transfer would deliver</h3>
                <p>
                  NEAR Intents can quote how much USDC would arrive on Arbitrum for a given amount sent
                  from Ethereum. NEAR helps arrange the cross-chain transfer—the funds do not have to
                  end up on NEAR.
                </p>
              </li>
              <li>
                <h3>Decide whether to proceed</h3>
                <p>
                  In a future cross-chain payment flow, the investor would review the quote before authorizing
                  payment. This Intents flow stops at the quote; it does not execute the cross-chain transfer.
                </p>
              </li>
            </ol>

            <h2>Why would we use it?</h2>
            <p>
              Investors and funds may hold assets on different networks. NEAR Intents can help connect
              those networks rather than making everyone use the same one. If both sides use bank
              transfers or already use the same network, this cross-chain feature may not be needed.
            </p>

            <h2>What does “confidential” mean here?</h2>
            <p>
              Individual commitment details are not shown on this app’s public pages. This is
              application-level access control, not proof of private onchain settlement.
            </p>
          </div>
        </article>
      </main>
      <footer className="footer">Demo only — public data shows approved raises and aggregates.</footer>
    </div>
  );
}
