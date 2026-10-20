import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type View = 'prospect' | 'sponsor' | 'progress';
type Commitment = { identifier: string; amount: number; hard: boolean };
const TARGET = 2_000_000;
const DEMO_LABEL = 'Demo only — synthetic data.';

function readSharedTotals() {
  const params = new URLSearchParams(window.location.search);
  const soft = Number(params.get('soft'));
  const hard = Number(params.get('hard'));
  if (!params.has('soft') || !params.has('hard') || !Number.isFinite(soft) || !Number.isFinite(hard)) return null;
  return { soft: Math.max(0, soft), hard: Math.max(0, hard) };
}

function euro(value: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function AppDesk() {
  const sharedTotals = useMemo(() => readSharedTotals(), []);
  const [view, setView] = useState<View>(sharedTotals ? 'progress' : 'prospect');
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [shareMessage, setShareMessage] = useState('');

  const softTotal = sharedTotals
    ? sharedTotals.soft
    : commitment && !commitment.hard ? commitment.amount : 0;
  const hardTotal = sharedTotals
    ? sharedTotals.hard
    : 50_000 + (commitment?.hard ? commitment.amount : 0);
  const progress = Math.min(100, (hardTotal / TARGET) * 100);

  const quoteBody = useMemo(() => {
    const amountInBaseUnits = String(Math.round((commitment?.amount ?? 0) * 1_000_000));
    const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    return {
      dry: true,
      swapType: 'EXACT_INPUT',
      slippageTolerance: 100,
      originAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
      depositType: 'ORIGIN_CHAIN',
      destinationAsset: 'nep141:arb-0x912ce59144191c1204e64559fe8253a0e49e6548.omft.near',
      amount: amountInBaseUnits,
      recipient: '0x0000000000000000000000000000000000000001',
      recipientType: 'DESTINATION_CHAIN',
      refundTo: '0x0000000000000000000000000000000000000002',
      refundType: 'ORIGIN_CHAIN',
      confidentiality: 'basic',
      deadline,
    };
  }, [commitment?.amount]);

  function submitCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!identifier.trim()) {
      setFormError('Enter an identifier.');
      return;
    }
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter a whole amount greater than zero.');
      return;
    }
    setCommitment({ identifier: identifier.trim(), amount: parsedAmount, hard: false });
    setFormError('');
    setView('sponsor');
  }

  function copyShareUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('view', 'progress');
    url.searchParams.set('soft', String(softTotal));
    url.searchParams.set('hard', String(hardTotal));
    const shareUrl = url.toString();
    const fallbackCopy = () => {
      const field = document.createElement('textarea');
      field.value = shareUrl;
      field.style.position = 'fixed';
      field.style.left = '-9999px';
      document.body.appendChild(field);
      field.focus();
      field.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(field);
      return copied;
    };
    if (!navigator.clipboard?.writeText) {
      setShareMessage(fallbackCopy() ? 'Share URL copied.' : 'Copy was unavailable.');
      return;
    }
    navigator.clipboard.writeText(shareUrl)
      .then(() => setShareMessage('Share URL copied.'))
      .catch(() => setShareMessage(fallbackCopy() ? 'Share URL copied.' : 'Copy was unavailable.'));
  }

  const views: { id: View; index: string; label: string }[] = [
    { id: 'prospect', index: '01', label: 'Prospect' },
    { id: 'sponsor', index: '02', label: 'Sponsor' },
    { id: 'progress', index: '03', label: 'Progress' },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Confidential Fundraise Desk">
          <span className="brand-mark" aria-hidden="true">F</span>
          <div>
            <div className="brand-name">Confidential Fundraise Desk</div>
          </div>
        </div>
        <span className="demo-label" data-testid="text-demo-label">{DEMO_LABEL}</span>
      </header>

      <main className="frame">
        <nav className="nav-row" aria-label="Fundraise views">
          {views.map((item) => (
            <button
              className={`nav-button${view === item.id ? ' active' : ''}`}
              key={item.id}
              type="button"
              data-testid={`nav-view-${item.id}`}
              onClick={() => { setView(item.id); setShareMessage(''); }}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <span className="nav-index">{item.index}</span>{item.label}
            </button>
          ))}
        </nav>

        {view === 'prospect' && (
          <section className="view-content content-grid" key="prospect">
            <div>
              <h2 className="section-title">Submit a soft commitment</h2>
              <form className="form-card" onSubmit={submitCommitment} noValidate>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="prospect-identifier">Identifier</label>
                  <input
                    className="field"
                    id="prospect-identifier"
                    data-testid="input-prospect-identifier"
                    name="identifier"
                    autoComplete="off"
                    maxLength={80}
                    placeholder="Name or reference"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                  />
                </div>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="prospect-amount">Amount</label>
                  <div className="amount-input">
                    <span className="currency">EUR</span>
                    <input
                      className="field"
                      id="prospect-amount"
                      data-testid="input-prospect-amount"
                      name="amount"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                </div>
                {formError && <p className="inline-error" data-testid="status-form-error" role="alert">{formError}</p>}
                <button className="primary-button" data-testid="button-submit-commitment" type="submit">
                  Submit soft commitment <span className="button-arrow" aria-hidden="true">↗</span>
                </button>
              </form>
            </div>
            <aside className="side-card">
                  <div className="side-label">Threshold</div>
              <h3 className="side-title">€2,000,000</h3>
                  <p className="side-copy">Settlement occurs only if aggregate hard commitments reach the €2m example threshold.</p>
            </aside>
          </section>
        )}

        {view === 'sponsor' && (
          <section className="view-content" key="sponsor">
            <div className="content-grid">
              <div>
                <h2 className="section-title">Sponsor review</h2>
                <p className="section-copy">Review the prospect’s soft commitment and mark it hard.</p>
                {commitment ? (
                  <div className="commitment-card">
                    <div className="commitment-meta">
                      <div className="record-line" data-testid="status-commitment">
                        <span className={`status-dot${commitment.hard ? ' hard' : ''}`} />
                        {commitment.hard ? 'Hard commitment' : 'Soft commitment'}
                      </div>
                      <div className="record-name" data-testid="text-commitment-identifier">{commitment.identifier}</div>
                      <div className="record-amount" data-testid="text-commitment-amount">{euro(commitment.amount)}</div>
                    </div>
                    <button
                      className={commitment.hard ? 'quiet-button' : 'mark-button'}
                      data-testid="button-toggle-hard-commitment"
                      type="button"
                      onClick={() => setCommitment({ ...commitment, hard: !commitment.hard })}
                    >
                      {commitment.hard ? 'Revert to soft' : 'Mark hard'}
                    </button>
                  </div>
                ) : (
                  <div className="empty-record" data-testid="status-empty-commitment">No prospect commitment has been submitted.</div>
                )}
              </div>
              <aside className="side-card">
                <div className="side-label">Threshold</div>
                <h3 className="side-title">€2,000,000</h3>
                <p className="side-copy">Settlement occurs only if aggregate hard commitments reach the €2m example threshold.</p>
              </aside>
            </div>
            {commitment?.hard && (
              <div className="quote-section">
                <div className="quote-heading">
                  <h3>NEAR Intents 1Click quote request</h3>
                  <p>Illustrative request body · no network request</p>
                </div>
                <div className="quote-card">
                  <div className="quote-topline">
                  <span className="quote-url" data-testid="text-quote-endpoint">POST https://1click.chaindefuser.com/v0/quote</span>
                    <span>application/json</span>
                  </div>
                  <pre className="quote-json" data-testid="text-quote-payload">{JSON.stringify(quoteBody, null, 2)}</pre>
                  <div className="quote-warning">Synthetic amount and address values. Display only.</div>
                </div>
              </div>
            )}
          </section>
        )}

        {view === 'progress' && (
          <section className="view-content" key="progress">
            <div className="eyebrow">Aggregate view</div>
            <div className="progress-panel">
              <div className="progress-top">
                <div>
                  <div className="aggregate-label">Progress toward €2m</div>
                  <div className="progress-total">{euro(hardTotal)}</div>
                </div>
                <div className="progress-target"><strong>{progress.toFixed(1)}%</strong><br />of €2,000,000</div>
              </div>
              <div
                className="progress-line"
                data-testid="progress-hard-total"
                role="progressbar"
                aria-label="Progress toward €2,000,000"
                aria-valuemin={0}
                aria-valuemax={TARGET}
                aria-valuenow={Math.min(hardTotal, TARGET)}
              >
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-scale"><span>€0</span><span>€2,000,000</span></div>
              <div className="aggregate-grid">
                <div className="aggregate">
                  <div className="aggregate-label">Soft total</div>
                  <div className="aggregate-value" data-testid="text-soft-total">{euro(softTotal)}</div>
                </div>
                <div className="aggregate">
                  <div className="aggregate-label">Hard total</div>
                  <div className="aggregate-value" data-testid="text-hard-total">{euro(hardTotal)}</div>
                </div>
              </div>
              <div className="share-row">
                <span className="share-note">Settlement occurs only if aggregate hard commitments reach the €2m example threshold.</span>
                <button className="quiet-button" data-testid="button-copy-share-url" type="button" onClick={copyShareUrl}>
                  Copy share URL <span className="button-arrow" aria-hidden="true">↗</span>
                </button>
              </div>
              <div className="toast-message" data-testid="status-share-url" aria-live="polite">{shareMessage}</div>
            </div>
          </section>
        )}
      </main>
      <footer className="footer" data-testid="text-demo-label-footer">{DEMO_LABEL}</footer>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={AppDesk} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
