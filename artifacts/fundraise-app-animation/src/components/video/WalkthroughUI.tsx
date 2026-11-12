import type { CSSProperties, ReactNode } from 'react';

export function AppChrome({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="app-window" style={style}>
      <div className="chrome" aria-hidden="true">
        <i className="chrome-dot" /><i className="chrome-dot" /><i className="chrome-dot" />
        <span className="chrome-url">fundraise / demo / privacy-token-fund</span>
      </div>
      {children}
    </div>
  );
}

export function AppMasthead({ flag = 'DEMO ONLY' }: { flag?: string }) {
  return (
    <div className="app-topbar">
      <div className="brand-lockup">
        <img src={`${import.meta.env.BASE_URL}images/fundraising-logo.png`} alt="" />
        <div>
          <div className="brand-title">Agent Raised</div>
          <div className="brand-kicker" style={{ marginTop: '.55vmin' }}>Powered by NEAR</div>
        </div>
      </div>
      <span className="app-flag">{flag}</span>
    </div>
  );
}

export function AppTabs({ active }: { active: 'progress' | 'prospect' | 'founder' }) {
  const items = [
    { id: 'progress', text: '01  Progress' },
    { id: 'prospect', text: 'Prospect' },
    { id: 'founder', text: 'Founder' },
  ] as const;
  return (
    <div className="app-tabs">
      {items.map((item) => (
        <span key={item.id} className={`app-tab${active === item.id ? ' active' : ''}`}>{item.text}</span>
      ))}
    </div>
  );
}

export function AppFootnote({ children }: { children: ReactNode }) {
  return <div className="ui-note" style={{ marginTop: '1.3vmin' }}>{children}</div>;
}
