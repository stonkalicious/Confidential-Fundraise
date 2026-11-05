import { Link } from 'wouter';
import type { Raise } from '@/data/raises';
import SiteHeader from '@/components/site-header';

export default function RaiseList({ raises }: { raises: Raise[] }) {
  const format = (amount: number) => new Intl.NumberFormat('en-IE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(amount);

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="frame">
        <h1 className="section-title">Raises</h1>
        <ul className="raise-list" data-testid="raise-list">
          {raises.map((raise) => (
            <li key={raise.id}>
              <Link className="raise-list-item" href={`/raises/${raise.id}`} data-testid={`raise-${raise.id}`}>
                <div>
                  <h2 className="section-title">{raise.companyName}</h2>
                  <p className="section-copy">{raise.thesis}</p>
                  <div className="raise-details">{raise.stage} · {format(raise.roundRange.min)} – {format(raise.roundRange.max)}</div>
                </div>
                <span className="raise-list-status">{raise.claimed ? `Claimed by ${raise.claim?.founderName ?? ''}` : 'Public data'} <span aria-hidden="true">↗</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <footer className="footer">Demo only — synthetic data.</footer>
    </div>
  );
}
