import { Link } from 'wouter';
import SiteHeader from '@/components/site-header';

export default function LegalDisclaimerPage() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="frame">
        <Link className="raise-back-link" href="/">← Active raises</Link>
        <section className="view-content roadmap-panel">
          <h1 className="roadmap-title">Legal disclaimer</h1>
          <p className="roadmap-intro"><strong>Hackathon prototype.</strong> Agent Raised is a hackathon submission, not a live fundraising business or investment platform.</p>
          <p className="roadmap-intro"><strong>No professional advice.</strong> Content is for informational and demonstration purposes only and is not investment, financial, legal, or tax advice. Seek independent professional advice before making investment decisions.</p>
          <p className="roadmap-intro"><strong>Data and claim status.</strong> Raise listings may include synthetic examples, public-source material, and user submissions; information is not independently verified. The app accepts soft commitments before a raise is claimed. These are non-binding records, not an offer, investment agreement, confirmed investment, or funds transfer. “Claimed” records someone’s claim to the page; it does not verify a founder’s identity or a company. Do not submit sensitive personal or confidential business information.</p>
          <p className="roadmap-intro"><strong>Wallet and transfer risks.</strong> Quotes do not execute transfers. Optional demo transfers are separate from recorded commitments. Testnet tokens have no real monetary value; mainnet transfers use real assets, incur fees, and may be irreversible. Review the network, recipient, and amount before approving any wallet action.</p>
        </section>
      </main>
      <footer className="footer">Demo only — public data shows approved raises and aggregates.</footer>
    </div>
  );
}
