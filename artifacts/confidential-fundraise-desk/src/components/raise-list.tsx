import { Link } from 'wouter';
import type { Raise } from '@/data/raises';

export default function RaiseList({ raises }: { raises: Raise[] }) {
  const format = (amount: number) => new Intl.NumberFormat('en-IE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(amount);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">F</span>
          <div className="brand-name">Confidential Fundraise Desk - Powered by NEAR</div>
        </div>
        <span className="demo-label">Demo only — synthetic data.</span>
      </header>
      <main className="frame">
        <h1 className="section-title">Raises</h1>
        <ul className="raise-list" data-testid="raise-list">
          {raises.map((raise) => (
            <li key={raise.id}>
              <Link className="raise-list-item" href={`/raises/${raise.id}`} data-testid={`raise-${raise.id}`}>
                <div>
                  <h2 className="section-title">{raise.companyName}</h2>
                  <p className="section-copy">{raise.thesis}</p>
                  {raise.isFundThesis ? (
                    <div className="raise-details">Fund-wide thesis · informational</div>
                  ) : (
                    <div className="raise-details">{raise.stage} · {format(raise.roundRange!.min)} – {format(raise.roundRange!.max)}</div>
                  )}
                </div>
                <span className="raise-list-status">{raise.isFundThesis ? 'Read thesis' : raise.claimed ? `Claimed by ${raise.claim?.founderName ?? ''}` : 'Public data'} <span aria-hidden="true">↗</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <footer className="footer">Demo only — synthetic data.</footer>
    </div>
  );
}
