import { useState } from 'react';
import { Link } from 'wouter';

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="brand" aria-label="Confidential Fundraising - Powered by NEAR">
        <img
          className="brand-mark"
          src={`${import.meta.env.BASE_URL}fundraising-logo.png`}
          width={32}
          height={32}
          alt=""
        />
        <div className="brand-name">Confidential Fundraising - Powered by NEAR</div>
      </div>
      <div className="topbar-actions">
        <span className="demo-label" data-testid="text-demo-label">Demo only</span>
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
                href="/why-near"
                data-testid="menu-why-near"
                onClick={() => setMenuOpen(false)}
              >
                Why NEAR?
              </Link>
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
