import type { ReactNode } from 'react';

export function ProposedBadge({ children = 'PROPOSED WORKFLOW' }: { children?: ReactNode }) {
  return <span className="proposed-badge mono"><i />{children}</span>;
}

export function AgentHeader({ who }: { who: string }) {
  return (
    <div className="agent-head">
      <span className="agent-glyph" aria-hidden="true" />
      <span className="mono agent-who">{who}</span>
      <span className="mono agent-ext">OUTSIDE THE APP</span>
    </div>
  );
}
