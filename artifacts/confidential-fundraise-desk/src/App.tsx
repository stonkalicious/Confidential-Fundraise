import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RaiseList from '@/components/raise-list';
import { INITIAL_RAISES, type Raise } from '@/data/raises';
import { ErrorBoundary } from '@/components/error-boundary';
import RulesCalculator from '@/components/rules-calculator';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Link,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type View = 'progress' | 'how' | 'prospect' | 'sponsor' | 'thesis' | 'rules' | 'roadmap';
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

function getInitialView(hasSharedTotals: boolean): View {
  if (hasSharedTotals) return 'progress';
  const requestedView = new URLSearchParams(window.location.search).get('view');
  if (
    requestedView === 'prospect' ||
    requestedView === 'sponsor' ||
    requestedView === 'progress' ||
    requestedView === 'how' ||
    requestedView === 'thesis' ||
    requestedView === 'rules' ||
    requestedView === 'roadmap'
  ) {
    return requestedView;
  }
  return 'progress';
}

function AppDesk({ raise, updateRaise }: { raise: Raise; updateRaise: (changes: Partial<Raise>) => void }) {
  const sharedTotals = useMemo(() => readSharedTotals(), []);
  const [view, setView] = useState<View>(() => getInitialView(Boolean(sharedTotals)));
  const commitments = raise.commitments ?? [];
  const [quoteCommitmentId, setQuoteCommitmentId] = useState<string | null>(null);
  const commitment = commitments.find((item) => item.id === quoteCommitmentId && item.hard)
    ?? commitments.find((item) => item.hard);
  const target = raise.roundRange.min;
  const [identifier, setIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [claimFormOpen, setClaimFormOpen] = useState(false);
  const [claimFounderName, setClaimFounderName] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimVehicleLink, setClaimVehicleLink] = useState('');
  const [claimError, setClaimError] = useState('');

  const softTotal = sharedTotals && commitments.length === 0
    ? sharedTotals.soft
    : commitments.reduce((total, item) => total + (item.hard ? 0 : item.amount), 0);
  const hardTotal = sharedTotals && commitments.length === 0
    ? sharedTotals.hard
    : commitments.reduce((total, item) => total + (item.hard ? item.amount : 0), 0);
  const progress = Math.min(100, (hardTotal / target) * 100);

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
    updateRaise({
      commitments: [...commitments, {
        id: crypto.randomUUID(),
        identifier: identifier.trim(),
        amount: parsedAmount,
        hard: false,
      }],
    });
    setIdentifier('');
    setAmount('');
    setFormError('');
    setView('sponsor');
  }

  function submitContactRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactSubmitted(true);
  }

  function submitRaiseClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClaimError('');
    if (!claimFounderName.trim()) {
      setClaimError('Enter a founder name.');
      return;
    }
    if (raise.claimed) return;
    updateRaise({
      claimed: true,
      claim: {
        founderName: claimFounderName.trim(),
        email: claimEmail.trim(),
        ...(claimVehicleLink.trim() ? { vehicleLink: claimVehicleLink.trim() } : {}),
      },
    });
    closeRaiseClaimForm();
  }

  function closeRaiseClaimForm() {
    setClaimFormOpen(false);
    setClaimFounderName('');
    setClaimEmail('');
    setClaimVehicleLink('');
    setClaimError('');
  }

  function toggleCommitmentHardStatus(id: string) {
    updateRaise({
      commitments: commitments.map((item) =>
        item.id === id ? { ...item, hard: !item.hard } : item
      ),
    });
    setQuoteCommitmentId(id);
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

  const views: { id: View; index?: string; label: string }[] = [
    { id: 'progress', index: '01', label: 'Progress' },
    { id: 'how', index: '02', label: 'How this app works' },
    { id: 'prospect', label: 'Prospect' },
    { id: 'sponsor', label: 'Sponsor' },
    { id: 'thesis', label: 'Thesis' },
    { id: 'rules', label: 'Rules Calculator' },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Confidential Fundraise Desk - Powered by NEAR">
          <span className="brand-mark" aria-hidden="true">F</span>
          <div>
            <div className="brand-name">Confidential Fundraise Desk - Powered by NEAR</div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="demo-label" data-testid="text-demo-label">{DEMO_LABEL}</span>
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
                <button
                  className="site-menu-item"
                  type="button"
                  data-testid="menu-roadmap"
                  onClick={() => {
                    setView('roadmap');
                    setShareMessage('');
                    setMenuOpen(false);
                  }}
                >
                  Roadmap
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="frame">
        <Link className="raise-back-link" href="/">← Raises</Link>
        <h1 className="raise-heading">{raise.companyName}</h1>
        <p className="section-copy">{raise.thesis}</p>
        <div className="raise-details">{raise.stage} · {euro(raise.roundRange.min)} – {euro(raise.roundRange.max)}</div>
        <nav className="nav-row" aria-label="Fundraise views">
          {views.map((item) => (
            <button
              className={`nav-button${view === item.id ? ' active' : ''}`}
              key={item.id}
              type="button"
              data-testid={`nav-view-${item.id}`}
              onClick={() => { setView(item.id); setShareMessage(''); setMenuOpen(false); }}
              aria-current={view === item.id ? 'page' : undefined}
            >
              {item.index && <span className="nav-index">{item.index}</span>}{item.label}
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
              <h3 className="side-title">{euro(target)}</h3>
                  <p className="side-copy">Settlement occurs only if aggregate hard commitments reach the {euro(target)} example threshold.</p>
            </aside>
          </section>
        )}

        {view === 'sponsor' && (
          <section className="view-content" key="sponsor">
            <div className="content-grid">
              <div>
                <h2 className="section-title">Sponsor review</h2>
                <p className="section-copy">Review prospects’ soft commitments and mark them hard.</p>
                {commitments.length > 0 ? (
                  <div data-testid="sponsor-commitment-list">
                  {commitments.map((item) => (
                  <div className="commitment-card" key={item.id} data-testid="commitment-row">
                    <div className="commitment-meta">
                      <div className="record-line" data-testid="status-commitment">
                        <span className={`status-dot${item.hard ? ' hard' : ''}`} />
                        {item.hard ? 'Hard commitment' : 'Soft commitment'}
                      </div>
                      <div className="record-name" data-testid="text-commitment-identifier">{item.identifier}</div>
                      <div className="record-amount" data-testid="text-commitment-amount">{euro(item.amount)}</div>
                    </div>
                    <button
                      className={item.hard ? 'quiet-button' : 'mark-button'}
                      data-testid="button-toggle-hard-commitment"
                      type="button"
                      aria-pressed={item.hard}
                      onClick={() => toggleCommitmentHardStatus(item.id)}
                    >
                      {item.hard ? 'Revert to soft' : 'Mark hard'}
                    </button>
                  </div>
                  ))}
                  </div>
                ) : (
                  <div className="empty-record" data-testid="status-empty-commitment">No prospect commitment has been submitted.</div>
                )}
              </div>
              <aside className="side-card">
                <div className="side-label">Threshold</div>
                <h3 className="side-title">{euro(target)}</h3>
                <p className="side-copy">Settlement occurs only if aggregate hard commitments reach the {euro(target)} example threshold.</p>
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
            <div className="raise-claim-toolbar">
              <div
                className="eyebrow raise-status-banner"
                data-testid="status-raise-claim"
                role="status"
                aria-live="polite"
              >
                {raise.claimed
                  ? `Claimed by ${raise.claim?.founderName ?? ''}`
                  : 'Public data'}
              </div>
              {!raise.claimed && (
                <button
                  className="quiet-button"
                  data-testid="button-claim-raise"
                  type="button"
                  onClick={() => {
                    setClaimError('');
                    setClaimFormOpen(true);
                  }}
                >
                  Claim this raise
                </button>
              )}
            </div>
            {claimFormOpen && !raise.claimed && (
              <form
                className="form-card raise-claim-form"
                data-testid="form-raise-claim"
                onSubmit={submitRaiseClaim}
              >
                <div className="field-wrap">
                  <label className="field-label" htmlFor="raise-claim-founder-name">Founder name</label>
                  <input
                    className="field"
                    id="raise-claim-founder-name"
                    data-testid="input-raise-claim-founder-name"
                    name="founderName"
                    autoComplete="name"
                    maxLength={120}
                    required
                    value={claimFounderName}
                    onChange={(event) => setClaimFounderName(event.target.value)}
                  />
                </div>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="raise-claim-email">Email</label>
                  <input
                    className="field"
                    id="raise-claim-email"
                    data-testid="input-raise-claim-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={claimEmail}
                    onChange={(event) => setClaimEmail(event.target.value)}
                  />
                </div>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="raise-claim-vehicle-link">Vehicle link (optional)</label>
                  <input
                    className="field"
                    id="raise-claim-vehicle-link"
                    data-testid="input-raise-claim-vehicle-link"
                    name="vehicleLink"
                    type="text"
                    maxLength={500}
                    value={claimVehicleLink}
                    onChange={(event) => setClaimVehicleLink(event.target.value)}
                  />
                </div>
                {claimError && (
                  <p className="inline-error raise-claim-error" data-testid="status-raise-claim-error" role="alert">
                    {claimError}
                  </p>
                )}
                <div className="raise-claim-actions">
                  <button
                    className="quiet-button"
                    data-testid="button-cancel-raise-claim"
                    type="button"
                    onClick={closeRaiseClaimForm}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    data-testid="button-submit-raise-claim"
                    type="submit"
                  >
                    Submit claim
                  </button>
                </div>
              </form>
            )}
            <div className="progress-panel">
              <div className="progress-top">
                <div>
                  <div className="aggregate-label">Progress toward {euro(target)}</div>
                  <div className="progress-total">{euro(hardTotal)}</div>
                </div>
                <div className="progress-target"><strong>{progress.toFixed(1)}%</strong><br />of {euro(target)}</div>
              </div>
              <div
                className="progress-line"
                data-testid="progress-hard-total"
                role="progressbar"
                aria-label={`Progress toward ${euro(target)}`}
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={Math.min(hardTotal, target)}
              >
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-scale"><span>€0</span><span>{euro(target)}</span></div>
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
                <span className="share-note">Settlement occurs only if aggregate hard commitments reach the {euro(target)} example threshold.</span>
                <button className="quiet-button" data-testid="button-copy-share-url" type="button" onClick={copyShareUrl}>
                  Copy share URL <span className="button-arrow" aria-hidden="true">↗</span>
                </button>
              </div>
              <div className="toast-message" data-testid="status-share-url" aria-live="polite">{shareMessage}</div>
            </div>
          </section>
        )}

        {view === 'how' && (
          <section className="view-content how-panel" key="how">
            <article className="how-copy">
              <h1 className="how-title">How the app works</h1>
              <p>Confidential Fundraise Desk is a minimal demo of private fundraise coordination.</p>
              <p>
                A prospect submits a soft commitment (identifier and amount). The sponsor reviews it privately and can mark it hard. Marking it hard generates a NEAR Intents 1Click quote request with confidential mode enabled, showing how the amount could settle cross-chain under a simple threshold rule without revealing individual details on a public chain.
              </p>
              <p>
                A separate progress view shows only aggregates (total soft, total hard, and progress toward a {euro(target)} example minimum). Individual names and amounts never appear there.
              </p>
              <p>
                The whole flow uses synthetic data and is labeled as a demo. It illustrates that commitments can stay private while settlement, if chosen, can use NEAR’s confidential cross-chain path.
              </p>
            </article>
          </section>
        )}

        {view === 'thesis' && (
          <section className="view-content thesis-panel" key="thesis">
            <article className="thesis-copy">
              <h1 className="thesis-title">Confidential Fundraise Desk — Example Thesis Summary</h1>
              <p className="thesis-disclaimer">(Demo context only. Synthetic. Not an offer.)</p>

              <h2>Private money and cross-chain settlement</h2>
              <p>
                Tokenized real-world assets are moving onto public blockchains because settlement is faster and cheaper than traditional markets. The same transfer that takes one to three days and multiple intermediaries can settle in minutes with fewer parties. Public chains, however, make every transfer visible by default. Large accumulations, rebalances, and ordinary movements become permanently linkable. AI systems make that linkage easier over time.
              </p>
              <p>Two existing systems address different parts of this problem.</p>

              <h3>ZEC</h3>
              <p>
                ZEC functions as private money. It has a fixed supply cap and uses zero-knowledge proofs so that shielded transfers do not reveal sender, receiver, or amount on the public chain. It is the most mature implementation of the original private-digital-cash idea. Legitimate uses include accumulating a position without moving the market, moving value between one’s own accounts without creating a permanent public link, and conducting business or treasury activity that does not need to be advertised. Shielded usage has continued to grow as the network has scaled.
              </p>

              <h3>NEAR Intents</h3>
              <p>
                NEAR Intents is a cross-chain settlement layer. A user (or agent) states a desired outcome. Competing solvers fill the order across whatever chains are required, and the result settles on NEAR. The same path already handles large volumes of crypto-to-crypto flow. As tokenized stocks, bonds, and other assets move on-chain, the same intent model can route those trades. Confidential mode keeps the details of a swap or transfer from being linkable on the public chains involved, while still allowing verifiable settlement.
              </p>

              <p>
                Together the two pieces cover private store-of-value and private cross-chain execution. A vehicle that holds listed products in both can express the view that financial privacy and chain-abstracted settlement will matter more as traditional assets move on-chain and as AI increases the ease of surveillance.
              </p>

              <h2>Illustrative structure</h2>
              <div className="thesis-structure">
                <p>Minimum target example: €2 million.</p>
                <p>Maximum example: €5 million.</p>
                <p>Simple fee and carry terms can be applied.</p>
                <p>Lock-up and term are contractual.</p>
                <p>All figures and terms in this document are synthetic examples for the demo.</p>
              </div>

              <p>
                This page is context for the Confidential Fundraise Desk prototype only. It demonstrates private commitment tracking and optional confidential settlement via NEAR Intents. It is not a solicitation.
              </p>
              <p>
                Interested parties may submit a contact request through the form below. No commitment is created by doing so.
              </p>
            </article>

            {contactSubmitted ? (
              <p className="thesis-confirmation" data-testid="status-contact-request" role="status">
                Request received (demo only).
              </p>
            ) : (
              <form className="form-card thesis-contact-form" onSubmit={submitContactRequest} noValidate>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="contact-name">Name</label>
                  <input className="field" id="contact-name" data-testid="input-contact-name" name="name" />
                </div>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="contact-email">Email</label>
                  <input className="field" id="contact-email" data-testid="input-contact-email" name="email" type="email" />
                </div>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="contact-message">Short message</label>
                  <textarea className="field thesis-message" id="contact-message" data-testid="input-contact-message" name="message" rows={4} />
                </div>
                <button className="primary-button" data-testid="button-submit-contact" type="submit">
                  Submit
                </button>
              </form>
            )}
          </section>
        )}

        {view === 'rules' && <RulesCalculator />}

        {view === 'roadmap' && (
          <section className="view-content roadmap-panel" key="roadmap">
            <h1 className="roadmap-title">Roadmap</h1>
            <p className="roadmap-status">(Not built — future direction only)</p>
            <p className="roadmap-intro">
              The current demo shows private soft commitments, a confidential NEAR Intents hard-commitment step under a minimum threshold, and an aggregate-only progress view.
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
        )}
      </main>
      <footer className="footer" data-testid="text-demo-label-footer">{DEMO_LABEL}</footer>
    </div>
  );
}

function Router() {
  const [raises, setRaises] = useState<Raise[]>(INITIAL_RAISES);
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/"><RaiseList raises={raises} /></Route>
        <Route path="/raises/:id">
          {(params) => {
            const raise = raises.find((item) => item.id === params.id);
            if (!raise) return <NotFound />;
            return (
              <AppDesk
                key={raise.id}
                raise={raise}
                updateRaise={(changes) => setRaises((current) => current.map((item) =>
                  item.id === raise.id ? { ...item, ...changes } : item
                ))}
              />
            );
          }}
        </Route>
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
