import { Link } from 'wouter';
import SiteHeader from '@/components/site-header';

export default function RoadmapPage() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="frame">
        <Link className="raise-back-link" href="/">← Active raises</Link>
        <section className="view-content roadmap-panel">
          <h1 className="roadmap-title">Roadmap</h1>
          <p className="roadmap-status">(Not built — future direction only)</p>
          <p className="roadmap-intro">
            The current demo stores soft commitments in a shared API, with a demo-only hard-commitment status and an aggregate-only progress view.
          </p>
          <h2 className="roadmap-list-title">Proposed agent workflow</h2>
          <ul className="roadmap-list">
            <li>Founders use their own agents to prepare a <strong>raise.md</strong> from company materials, including sources and flagged missing information.</li>
            <li>Founders review and approve the information before it becomes public.</li>
            <li>Investors use their own agents to find public raises matching their interests.</li>
            <li>Agents compare the evidence, risks and open questions and return a shortlist.</li>
            <li>Investors decide whether to proceed. The agent commits nothing.</li>
          </ul>
          <p className="roadmap-outro">
            This workflow is proposed, not built into the current demo. Public discovery would use public raise information only—not private commitments or investor contact details.
          </p>
        </section>
      </main>
      <footer className="footer">Demo only — public data shows approved raises and aggregates.</footer>
    </div>
  );
}
