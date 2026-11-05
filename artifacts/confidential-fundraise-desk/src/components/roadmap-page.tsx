import { Link } from 'wouter';
import SiteHeader from '@/components/site-header';

export default function RoadmapPage() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="frame">
        <Link className="raise-back-link" href="/">← Raises</Link>
        <section className="view-content roadmap-panel">
          <h1 className="roadmap-title">Roadmap</h1>
          <p className="roadmap-status">(Not built — future direction only)</p>
          <p className="roadmap-intro">
            The current demo stores soft commitments in a shared API, with a demo-only hard-commitment status, an illustrative NEAR Intents quote, and an aggregate-only progress view.
          </p>
          <h2 className="roadmap-list-title">Possible extensions:</h2>
          <ul className="roadmap-list">
            <li>Programmable fees taken automatically on commitment or over time</li>
            <li>Hard caps on total commitments</li>
            <li>Time-locks and minimum holding periods</li>
            <li>Preferred-return or hurdle gates before distributions</li>
            <li>Automated distribution waterfalls</li>
            <li>Capital calls and scheduled drawdowns</li>
            <li>Default and reallocation rules</li>
            <li>Per-commitment restrictions or excuse provisions</li>
            <li>Post-close asset allocation or swaps under the same confidential path</li>
          </ul>
          <p className="roadmap-outro">
            All of the above can be expressed as mechanical rules on the NEAR Intents confidential settlement layer. None of them are required for the current demo.
          </p>
        </section>
      </main>
      <footer className="footer">Demo only — public data shows approved raises and aggregates.</footer>
    </div>
  );
}
