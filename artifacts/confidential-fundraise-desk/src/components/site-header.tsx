import { useState } from 'react';
import { Link } from 'wouter';

const DEFAULT_DEMO_LABEL = 'Demo only — details local; summary public.';

export default function SiteHeader({ demoLabel = DEFAULT_DEMO_LABEL }: { demoLabel?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="brand" aria-label="Confidential Fundraise Desk - Powered by NEAR">
        <span className="brand-mark" aria-hidden="true">F</span>
        <div className="brand-name">Confidential Fundraise Desk - Powered by NEAR</div>
      </div>
      <div className="topbar-actions">
        <span className="demo-label" data-testid="text-demo-label">{demoLabel}</span>
        <div
          className="site-menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setMenuOpen(false);
          }}
        >
          <button
            className="site-menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-controls="site-menu-dropdown"
            data-testid="button-site-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-icon" aria-hidden="true"><i /><i /><i /></span>
          </button>
          {menuOpen && (
            <div className="site-menu-dropdown" id="site-menu-dropdown" aria-label="More pages">
              <Link
                className="site-menu-item"
                href="/roadmap"
                data-testid="menu-roadmap"
                onClick={() => setMenuOpen(false)}
              >
                Roadmap
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
