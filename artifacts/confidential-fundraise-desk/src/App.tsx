import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  claimRaise as claimRaiseApi,
  getPrivateRaise as getPrivateRaiseApi,
  getRaises as getRaisesApi,
  requestDemoQuote as requestDemoQuoteApi,
  submitSoftCommitment as submitSoftCommitmentApi,
  updateRaiseCommitment as updateRaiseCommitmentApi,
  type ClaimRaiseInput,
  type CommitmentStatusInput,
  type DemoIntentsQuote,
  type PrivateRaiseDetails,
  type RaiseSummary,
} from '@workspace/api-client-react';
import RaiseList from '@/components/raise-list';
import { getSafeSourceLink, INITIAL_RAISES, type Raise } from '@/data/raises';
import RoadmapPage from '@/components/roadmap-page';
import WhyNearPage from '@/components/why-near-page';
import SiteHeader from '@/components/site-header';
import { DemoSettlementCard, InvestorDemoSettlements } from '@/components/demo-settlement';
import { newDemoReceipt, rememberDemoReceipt } from '@/lib/demo-settlement-wallet';
import { loadRaises, saveRaises } from '@/data/raise-storage';
import { createQuoteOutcomeReporter, getQuoteFailureOutcome } from '@/lib/analytics';
import { startSponsorIdleLock } from '@/lib/sponsor-idle-lock';
import { isTemporaryNearSessionRefreshFailure } from '@/lib/near-session-recovery';
import {
  authenticateNearWallet,
  disconnectNearWallet,
  NearIntentsKeyRegistrationRequiredError,
  registerNearIntentsKeyAndAuthenticate,
  refreshNearWalletSession,
  type NearUserSession,
} from '@/lib/near-intents-auth';
import { ErrorBoundary } from '@/components/error-boundary';
import RulesCalculator from '@/components/rules-calculator';
import NearDemoPanel from '@/components/near-demo-panel';
import { deriveNearDemoPanelState } from '@/lib/near-demo-panel';
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

type View = 'progress' | 'how' | 'prospect' | 'sponsor' | 'thesis' | 'rules';
const DEMO_LABEL = 'Demo only — public data shows approved raises and aggregates.';

function mergeApiRaise(summary: RaiseSummary, base: Raise): Raise {
  const localCommitments = base.commitments ?? [];
  const localSoftTotal = localCommitments.reduce(
    (total, item) => total + (item.hard ? 0 : item.amount),
    0,
  );
  const localHardTotal = localCommitments.reduce(
    (total, item) => total + (item.hard ? item.amount : 0),
    0,
  );
  const useLocalTotals =
    summary.softTotal === 0 &&
    summary.hardTotal === 0 &&
    (localSoftTotal > 0 || localHardTotal > 0);
  return {
    ...base,
    companyName: summary.name,
    thesis: summary.thesis,
    stage: summary.stage,
    sourceLink: summary.sourceLink ?? base.sourceLink,
    rangeIsIndicative: summary.rangeIsIndicative ?? base.rangeIsIndicative,
    categories: summary.categories ?? base.categories,
    roundRange: summary.range,
    claimed: summary.claimed || Boolean(base.claim),
    claimantName: summary.claimantName ?? base.claimantName ?? base.claim?.founderName ?? null,
    softTotal: useLocalTotals ? localSoftTotal : summary.softTotal,
    hardTotal: useLocalTotals ? localHardTotal : summary.hardTotal,
    ...(summary.confirmedTestnetTransfers !== undefined
      ? { confirmedTestnetTransfers: summary.confirmedTestnetTransfers }
      : {}),
  };
}

function mergeApiRaises(summaries: RaiseSummary[], current: Raise[]): Raise[] {
  return summaries.map((summary) => {
    const base =
      current.find((item) => item.id === summary.id) ??
      INITIAL_RAISES.find((item) => item.id === summary.id) ?? {
        id: summary.id,
        companyName: summary.name,
        thesis: summary.thesis,
        investmentThesis: summary.thesis,
        stage: summary.stage,
        roundRange: summary.range,
        claimed: summary.claimed,
      };
    return mergeApiRaise(summary, base);
  });
}

function requestErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function isHttpStatus(error: unknown, status: number): boolean {
  return error !== null && typeof error === 'object' && 'status' in error && error.status === status;
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUsdcBaseUnits(amount: string): string {
  try {
    const units = BigInt(amount);
    const whole = units / 1_000_000n;
    const fractional = String(units % 1_000_000n).padStart(6, '0').replace(/0+$/, '');
    return fractional ? `${whole}.${fractional}` : String(whole);
  } catch {
    return `${amount} base units`;
  }
}

type DemoQuoteState =
  | { commitmentId: string; status: 'ready' }
  | { commitmentId: string; status: 'loading' }
  | { commitmentId: string; status: 'error'; error: string }
  | { commitmentId: string; status: 'success'; result: DemoIntentsQuote };

function getInitialView(): View {
  const requestedView = new URLSearchParams(window.location.search).get('view');
  if (
    requestedView === 'prospect' ||
    requestedView === 'sponsor' ||
    requestedView === 'progress' ||
    requestedView === 'how' ||
    requestedView === 'thesis' ||
    requestedView === 'rules'
  ) {
    return requestedView;
  }
  return 'progress';
}

function AppDesk({
  raise,
  onClaimRaise,
  onSubmitSoftCommitment,
  onGetPrivateRaise,
  onUpdateCommitment,
  onRequestDemoQuote,
}: {
  raise: Raise;
  onClaimRaise: (claim: ClaimRaiseInput) => Promise<void>;
  onSubmitSoftCommitment: (identifier: string, amount: number) => Promise<void>;
  onGetPrivateRaise: (approvalCode: string) => Promise<PrivateRaiseDetails>;
  onUpdateCommitment: (
    id: string,
    status: CommitmentStatusInput,
    approvalCode: string,
  ) => Promise<void>;
  onRequestDemoQuote: (
    commitmentId: string,
    approvalCode: string,
    userSessionToken: string,
  ) => Promise<DemoIntentsQuote>;
}) {
  const isFundThesis = raise.isFundThesis === true;
  const [view, setView] = useState<View>(getInitialView);
  const [approvalCode, setApprovalCode] = useState('');
  const [privateRaise, setPrivateRaise] = useState<PrivateRaiseDetails | null>(null);
  const sponsorSessionVersion = useRef(0);
  const [sponsorLoading, setSponsorLoading] = useState(false);
  const commitments = privateRaise?.commitments ?? [];
  const [quoteState, setQuoteState] = useState<DemoQuoteState | null>(null);
  const [nearSession, setNearSession] = useState<NearUserSession | null>(null);
  const [nearSessionUnavailable, setNearSessionUnavailable] = useState(false);
  const [nearAuthLoading, setNearAuthLoading] = useState(false);
  const [nearAuthError, setNearAuthError] = useState('');
  const [nearKeyRegistration, setNearKeyRegistration] =
    useState<NearIntentsKeyRegistrationRequiredError | null>(null);
  const quotedCommitment = quoteState
    ? commitments.find((item) => item.id === quoteState.commitmentId && item.hard)
    : undefined;
  const target = raise.roundRange.min;
  const nearDemoFocusPending = useRef(false);
  const nearDemoPanelState = deriveNearDemoPanelState({
    unlocked: privateRaise !== null,
    session: nearSession,
    sessionUnavailable: nearSessionUnavailable,
    authLoading: nearAuthLoading,
    authError: Boolean(nearAuthError),
    keyRegistrationPending: nearKeyRegistration !== null,
    quoteStatus: quoteState?.status ?? null,
    hasQuotedHardCommitment: Boolean(quotedCommitment),
    confidentialityRequested:
      quoteState?.status === 'success' ? quoteState.result.confidentialityRequested : null,
    now: Date.now(),
  });
  const [identifier, setIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [claimFormOpen, setClaimFormOpen] = useState(false);
  const [claimFounderName, setClaimFounderName] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimSignatureOrAccount, setClaimSignatureOrAccount] = useState('');
  const [claimError, setClaimError] = useState('');
  const [sponsorError, setSponsorError] = useState('');

  const localSoftTotal = (raise.commitments ?? []).reduce(
    (total, item) => total + (item.hard ? 0 : item.amount),
    0,
  );
  const localHardTotal = (raise.commitments ?? []).reduce(
    (total, item) => total + (item.hard ? item.amount : 0),
    0,
  );
  const softTotal = raise.softTotal ?? localSoftTotal;
  const hardTotal = raise.hardTotal ?? localHardTotal;
  const progress = Math.min(100, (hardTotal / target) * 100);

  useEffect(() => {
    if (view !== 'sponsor') {
      sponsorSessionVersion.current += 1;
      setApprovalCode('');
      setPrivateRaise(null);
      setQuoteState(null);
      setNearSession(null);
      setNearSessionUnavailable(false);
      setNearAuthError('');
      setNearKeyRegistration(null);
      setSponsorError('');
    }
  }, [view]);

  useEffect(() => {
    if (view !== 'sponsor') return;
    let active = true;
    setNearAuthLoading(true);
    void refreshNearWalletSession()
      .then((session) => {
        if (active) {
          setNearSession(session);
          setNearSessionUnavailable(false);
        }
      })
      .catch((error: unknown) => {
        if (active && isTemporaryNearSessionRefreshFailure(error)) {
          setNearSessionUnavailable(true);
          setNearAuthError(
            'NEAR Intents is temporarily unavailable. Retry your saved wallet session without signing again.',
          );
        }
      })
      .finally(() => {
        if (active) setNearAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view]);

  useEffect(() => {
    if (view !== 'sponsor') return;

    const clearSponsorState = () => {
      sponsorSessionVersion.current += 1;
      setApprovalCode('');
      setPrivateRaise(null);
      setQuoteState(null);
      setNearSession(null);
      setNearSessionUnavailable(false);
      setNearAuthError('');
      setNearKeyRegistration(null);
      setSponsorError('');
      setSponsorLoading(false);
    };
    const stopIdleLock = startSponsorIdleLock(clearSponsorState);
    return () => {
      stopIdleLock();
      sponsorSessionVersion.current += 1;
    };
  }, [view]);

  useEffect(() => {
    if (view !== 'sponsor' || !nearDemoFocusPending.current) return;
    nearDemoFocusPending.current = false;
    const target = document.getElementById(
      privateRaise ? 'near-demo-panel' : 'sponsor-approval-code',
    );
    target?.focus();
  }, [view, privateRaise]);

  function openNearDemo() {
    nearDemoFocusPending.current = true;
    setShareMessage('');
    setView('sponsor');
  }

  async function submitCommitment(event: FormEvent<HTMLFormElement>) {
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
    try {
      await onSubmitSoftCommitment(identifier.trim(), parsedAmount);
      setIdentifier('');
      setAmount('');
      setFormError('');
      setView('sponsor');
    } catch (error) {
      setFormError(requestErrorMessage(error, 'The commitment could not be submitted.'));
    }
  }

  async function unlockSponsor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSponsorError('');
    if (!approvalCode) {
      setSponsorError('Enter the founder approval code.');
      return;
    }
    const sessionVersion = sponsorSessionVersion.current;
    setSponsorLoading(true);
    try {
      const result = await onGetPrivateRaise(approvalCode);
      if (sessionVersion === sponsorSessionVersion.current) {
        setPrivateRaise(result);
      }
    } catch (error) {
      if (sessionVersion === sponsorSessionVersion.current) {
        setPrivateRaise(null);
        setSponsorError(requestErrorMessage(error, 'Private founder details could not be loaded.'));
      }
    } finally {
      if (sessionVersion === sponsorSessionVersion.current) {
        setSponsorLoading(false);
      }
    }
  }

  function applyPrivateCommitmentStatus(id: string, status: CommitmentStatusInput) {
    setPrivateRaise((current) => {
      if (!current) return current;
      const updatedCommitments = current.commitments.map((item) =>
        item.id === id ? { ...item, ...status } : item
      );
      return {
        ...current,
        commitments: updatedCommitments,
        softTotal: updatedCommitments.reduce(
          (total, item) => total + (item.hard ? 0 : item.amount),
          0,
        ),
        hardTotal: updatedCommitments.reduce(
          (total, item) => total + (item.hard ? item.amount : 0),
          0,
        ),
      };
    });
  }

  async function requestDemoQuote(commitmentId: string) {
    const reportOutcome = createQuoteOutcomeReporter();
    let session = nearSession;
    let refreshTemporarilyUnavailable = false;
    if (!session || session.expiresAt <= Date.now() + 30_000) {
      try {
        session = await refreshNearWalletSession();
        setNearSession(session);
        setNearSessionUnavailable(false);
      } catch (error) {
        const temporaryFailure = isTemporaryNearSessionRefreshFailure(error);
        refreshTemporarilyUnavailable = temporaryFailure;
        setNearSessionUnavailable(temporaryFailure);
        if (temporaryFailure) {
          setNearAuthError(
            'NEAR Intents is temporarily unavailable. Retry your saved wallet session without signing again.',
          );
        }
        session = null;
      }
    }
    if (!session) {
      setNearSession(null);
      setQuoteState({
        commitmentId,
        status: 'error',
        error: refreshTemporarilyUnavailable
          ? 'NEAR Intents is temporarily unavailable. Retry the saved wallet session before requesting this quote.'
          : 'Authenticate a NEAR wallet before requesting this confidential quote.',
      });
      reportOutcome('auth_required');
      return;
    }
    const sessionVersion = sponsorSessionVersion.current;
    setQuoteState({ commitmentId, status: 'loading' });
    try {
      let result: DemoIntentsQuote;
      try {
        result = await onRequestDemoQuote(commitmentId, approvalCode, session.accessToken);
      } catch (error) {
        if (getQuoteFailureOutcome(error) !== 'auth_required') throw error;
        session = await refreshNearWalletSession();
        if (sessionVersion === sponsorSessionVersion.current) setNearSession(session);
        result = await onRequestDemoQuote(commitmentId, approvalCode, session.accessToken);
      }
      if (sessionVersion === sponsorSessionVersion.current) {
        setQuoteState({ commitmentId, status: 'success', result });
      }
      reportOutcome('success');
    } catch (error) {
      const outcome = getQuoteFailureOutcome(error);
      const authRequired = outcome === 'auth_required';
      if (sessionVersion === sponsorSessionVersion.current) {
        if (authRequired) setNearSession(null);
        setQuoteState({
          commitmentId,
          status: 'error',
          error: requestErrorMessage(error, 'The NEAR Intents quote request failed. No funds moved.'),
        });
      }
      reportOutcome(outcome);
    }
  }

  async function connectNearWallet() {
    const sessionVersion = sponsorSessionVersion.current;
    setNearAuthLoading(true);
    setNearAuthError('');
    setNearKeyRegistration(null);
    try {
      const session = await authenticateNearWallet();
      if (sessionVersion === sponsorSessionVersion.current) {
        setNearSession(session);
        setNearSessionUnavailable(false);
      }
    } catch (error) {
      if (sessionVersion === sponsorSessionVersion.current) {
        if (error instanceof NearIntentsKeyRegistrationRequiredError) {
          setNearKeyRegistration(error);
        } else {
          setNearAuthError(
            requestErrorMessage(error, 'NEAR wallet authentication did not complete. No funds moved.'),
          );
        }
      }
    } finally {
      if (sessionVersion === sponsorSessionVersion.current) {
        setNearAuthLoading(false);
      }
    }
  }

  async function registerNearWalletKey() {
    if (!nearKeyRegistration) return;
    const sessionVersion = sponsorSessionVersion.current;
    setNearAuthLoading(true);
    setNearAuthError('');
    try {
      const session = await registerNearIntentsKeyAndAuthenticate(nearKeyRegistration);
      if (sessionVersion === sponsorSessionVersion.current) {
        setNearKeyRegistration(null);
        setNearSession(session);
        setNearSessionUnavailable(false);
      }
    } catch (error) {
      if (sessionVersion === sponsorSessionVersion.current) {
        setNearAuthError(
          requestErrorMessage(error, 'NEAR key registration did not complete. No quote was requested.'),
        );
      }
    } finally {
      if (sessionVersion === sponsorSessionVersion.current) {
        setNearAuthLoading(false);
      }
    }
  }

  async function clearNearWalletSession() {
    setNearAuthError('');
    try {
      await disconnectNearWallet();
      setNearSession(null);
      setNearSessionUnavailable(false);
      setNearKeyRegistration(null);
    } catch (error) {
      setNearAuthError(
        requestErrorMessage(error, 'The NEAR wallet session could not be cleared. Try again.'),
      );
    }
  }

  async function retrySavedNearSession() {
    const sessionVersion = sponsorSessionVersion.current;
    setNearAuthLoading(true);
    setNearAuthError('');
    try {
      const session = await refreshNearWalletSession();
      if (sessionVersion === sponsorSessionVersion.current) {
        setNearSession(session);
        setNearSessionUnavailable(false);
      }
    } catch (error) {
      if (sessionVersion === sponsorSessionVersion.current) {
        setNearSessionUnavailable(isTemporaryNearSessionRefreshFailure(error));
        setNearAuthError(
          isTemporaryNearSessionRefreshFailure(error)
            ? 'NEAR Intents is still unavailable. Retry your saved wallet session shortly.'
            : 'The saved NEAR wallet session has expired. Authenticate again to continue.',
        );
      }
    } finally {
      if (sessionVersion === sponsorSessionVersion.current) {
        setNearAuthLoading(false);
      }
    }
  }

  function submitContactRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactSubmitted(true);
  }

  async function submitRaiseClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClaimError('');
    if (!claimFounderName.trim()) {
      setClaimError('Enter a founder name.');
      return;
    }
    if (raise.claimed) return;
    if (raise.claimed) {
      setClaimError('This raise has already been claimed.');
      return;
    }
    try {
      await onClaimRaise({
        founderName: claimFounderName.trim(),
        email: claimEmail.trim(),
        ...(claimSignatureOrAccount.trim()
          ? { signatureOrAccount: claimSignatureOrAccount.trim() }
          : {}),
      });
      closeRaiseClaimForm();
    } catch (error) {
      setClaimError(requestErrorMessage(error, 'The claim could not be submitted.'));
    }
  }

  function closeRaiseClaimForm() {
    setClaimFormOpen(false);
    setClaimFounderName('');
    setClaimEmail('');
    setClaimSignatureOrAccount('');
    setClaimError('');
  }

  async function toggleCommitmentHardStatus(id: string) {
    const item = commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    const sessionVersion = sponsorSessionVersion.current;
    setSponsorError('');
    try {
      const status = { hard: !item.hard, verified: false };
      await onUpdateCommitment(id, status, approvalCode);
      if (sessionVersion !== sponsorSessionVersion.current) return;
      applyPrivateCommitmentStatus(id, status);
      if (status.hard) {
        setQuoteState({ commitmentId: id, status: 'ready' });
      } else if (quoteState?.commitmentId === id) {
        setQuoteState(null);
      }
    } catch (error) {
      if (sessionVersion === sponsorSessionVersion.current) {
        setSponsorError(requestErrorMessage(error, 'The commitment status could not be updated.'));
      }
    }
  }

  async function verifyCommitment(id: string) {
    const sessionVersion = sponsorSessionVersion.current;
    setSponsorError('');
    try {
      const status = { hard: true, verified: true };
      await onUpdateCommitment(id, status, approvalCode);
      if (sessionVersion !== sponsorSessionVersion.current) return;
      applyPrivateCommitmentStatus(id, status);
      setQuoteState({ commitmentId: id, status: 'ready' });
    } catch (error) {
      if (sessionVersion === sponsorSessionVersion.current) {
        setSponsorError(requestErrorMessage(error, 'The commitment could not be verified.'));
      }
    }
  }

  function copyShareUrl() {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
    const url = new URL(`${base}raises/${encodeURIComponent(raise.id)}`, window.location.origin);
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
    { id: 'sponsor', label: 'Founder' },
    { id: 'thesis', label: 'Thesis' },
    { id: 'rules', label: 'Rules Calculator' },
  ];
  const sourceLink = getSafeSourceLink(raise.sourceLink);

  return (
    <div className="app-shell">
      <SiteHeader />

      <main className="frame">
        <Link className="raise-back-link" href="/">← Active raises</Link>
        <h1 className="raise-heading">{raise.companyName}</h1>
        <p className="section-copy">{raise.thesis}</p>
        <div className="raise-details">{raise.stage} · {usd(raise.roundRange.min)} – {usd(raise.roundRange.max)}</div>
        {raise.rangeIsIndicative && (
          <p className="raise-details">Approximate range; not a verified fundraising ask.</p>
        )}
        {sourceLink && (
          <a
            className="raise-source-link"
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Source for ${raise.companyName}`}
          >
            Source <span aria-hidden="true">↗</span>
          </a>
        )}
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
              {item.index && <span className="nav-index">{item.index}</span>}{item.label}
            </button>
          ))}
        </nav>

        <InvestorDemoSettlements raiseId={raise.id} />

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
                    <span className="currency">USD</span>
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
              <h3 className="side-title">{usd(target)}</h3>
                  <p className="side-copy">The demo threshold is met when aggregate hard commitments reach {usd(target)}. Reaching it does not trigger settlement.</p>
            </aside>
          </section>
        )}

        {view === 'sponsor' && (
          <section className="view-content" key="sponsor">
            <div className="content-grid">
              <div>
                <h2 className="section-title">Founder review</h2>
                {sponsorError && (
                  <p className="inline-error" data-testid="status-sponsor-error" role="alert">
                    {sponsorError}
                  </p>
                )}
                {!privateRaise ? (
                  <form className="sponsor-unlock-form" onSubmit={unlockSponsor}>
                    <div className="field-wrap">
                      <label className="field-label" htmlFor="sponsor-approval-code">Founder approval code</label>
                      <input
                        className="field"
                        id="sponsor-approval-code"
                        data-testid="input-sponsor-approval-code"
                        type="password"
                        autoComplete="current-password"
                        value={approvalCode}
                        onChange={(event) => setApprovalCode(event.target.value)}
                      />
                    </div>
                    <button className="primary-button" type="submit" disabled={sponsorLoading}>
                      {sponsorLoading ? 'Loading…' : 'Unlock founder view'}
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="founder-review-guidance" data-testid="text-founder-review-guidance">
                      Review each commitment. Mark it hard only after it is confirmed. Testnet transfers and quotes are optional demos; they do not change fundraising totals.
                    </p>
                    {privateRaise.claim && (
                      <section className="claim-contact-card" data-testid="sponsor-claim-contact">
                        <div className="side-label">Claim contact</div>
                        <div className="record-name">{privateRaise.claim.founderName}</div>
                        <div className="record-amount">{privateRaise.claim.email}</div>
                        {privateRaise.claim.signatureOrAccount && (
                          <div className="record-amount">{privateRaise.claim.signatureOrAccount}</div>
                        )}
                      </section>
                    )}
                    {commitments.length > 0 ? (
                      <div data-testid="sponsor-commitment-list">
                        {commitments.map((item) => (
                          <div className="founder-commitment" key={item.id}>
                          <div className="commitment-card" data-testid="commitment-row">
                            <div className="commitment-meta">
                              <div className="record-line" data-testid="status-commitment">
                                <span className={`status-dot${item.hard ? ' hard' : ''}`} />
                                {item.verified ? 'Verified commitment' : item.hard ? 'Hard commitment' : 'Soft commitment'}
                              </div>
                              <div className="record-name" data-testid="text-commitment-identifier">{item.identifier}</div>
                              <div className="record-amount" data-testid="text-commitment-amount">{usd(item.amount)}</div>
                              {item.verified && (
                                <div className="verification-label" data-testid="text-verification-label">NEAR confidential verification (demo — no blockchain call)</div>
                              )}
                            </div>
                            <div className="commitment-actions">
                              {!item.hard && (
                                <button
                                  className="mark-button"
                                  data-testid="button-mark-verified"
                                  type="button"
                                  onClick={() => verifyCommitment(item.id)}
                                >
                                  Mark verified (demo)
                                </button>
                              )}
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
                          </div>
                          <section className="commitment-demos" aria-label={`Optional demos for ${item.identifier}`}>
                            <div className="commitment-demos-heading">
                              <div>
                                <h3>Optional demos</h3>
                                <p>Separate from commitment review; these do not change fundraising totals.</p>
                              </div>
                              {item.hard && (
                                <button
                                  className="quiet-button"
                                  data-testid="button-prepare-quote"
                                  type="button"
                                  onClick={() =>
                                    setQuoteState({ commitmentId: item.id, status: 'ready' })
                                  }
                                >
                                  Request quote
                                </button>
                              )}
                            </div>
                            <DemoSettlementCard raiseId={raise.id} commitmentId={item.id} approvalCode={approvalCode} />
                          </section>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-record" data-testid="status-empty-commitment">
                        No prospect commitment has been submitted.
                      </div>
                    )}
                  </>
                )}
              </div>
              <aside className="side-card">
                <div className="side-label">Threshold</div>
                <h3 className="side-title">{usd(target)}</h3>
                <p className="side-copy">The demo threshold is met when aggregate hard commitments reach {usd(target)}. Reaching it does not trigger settlement.</p>
                <NearDemoPanel state={nearDemoPanelState} />
              </aside>
            </div>
            {quoteState && quotedCommitment && (
              <section className="quote-section" aria-labelledby="near-quote-title">
                <div className="quote-heading">
                  <h3 id="near-quote-title">NEAR Intents 1Click quote</h3>
                  <p>Live API request · dry run only · no funds moved</p>
                </div>
                <div className="quote-card">
                  <div className="quote-topline">
                    <span className="quote-url" data-testid="text-quote-endpoint">POST https://1click.chaindefuser.com/v0/quote</span>
                    <span>confidentiality: basic</span>
                  </div>
                  <div className="near-auth-row">
                    <div>
                      <strong data-testid="text-near-session-account">
                        {nearSession
                          ? `NEAR wallet: ${nearSession.accountId}`
                          : 'NEAR wallet not authenticated'}
                      </strong>
                      <p>
                        Authentication signs an empty intent only. It does not authorize a swap or move tokens.
                      </p>
                    </div>
                    {nearSession ? (
                      <button
                        className="quiet-button"
                        data-testid="button-disconnect-near-wallet"
                        type="button"
                        onClick={clearNearWalletSession}
                      >
                        Disconnect NEAR wallet
                      </button>
                    ) : nearSessionUnavailable ? (
                      <button
                        className="primary-button"
                        data-testid="button-retry-saved-near-session"
                        type="button"
                        onClick={retrySavedNearSession}
                        disabled={nearAuthLoading}
                      >
                        {nearAuthLoading ? 'Retrying saved session…' : 'Retry saved session'}
                      </button>
                    ) : !nearKeyRegistration ? (
                      <button
                        className="primary-button"
                        data-testid="button-authenticate-near-wallet"
                        type="button"
                        onClick={connectNearWallet}
                        disabled={nearAuthLoading}
                      >
                        {nearAuthLoading ? 'Authenticating…' : 'Authenticate with NEAR wallet'}
                      </button>
                    ) : null}
                  </div>
                  {nearAuthError && (
                    <p className="quote-result quote-result-error" role="alert" data-testid="status-near-auth-error">
                      {nearAuthError}
                    </p>
                  )}
                  {nearKeyRegistration && !nearSession && (
                    <div className="quote-result" role="status" data-testid="status-near-key-registration">
                      <p>
                        This named NEAR account has not registered its current public key with NEAR Intents.
                        To continue, approve a one-time mainnet transaction that calls add_public_key on intents.near.
                      </p>
                      <p>
                        The transaction attaches 1 yoctoNEAR and also costs NEAR network gas, paid by this account.
                        Your wallet will show the exact gas fee before you approve the transaction. This is not a swap
                        and does not move investment funds.
                      </p>
                      <div className="quote-action-row">
                        <button
                          className="primary-button"
                          data-testid="button-register-near-key"
                          type="button"
                          onClick={registerNearWalletKey}
                          disabled={nearAuthLoading}
                        >
                          {nearAuthLoading ? 'Registering key…' : 'Approve and register key'}
                        </button>
                        <button
                          className="quiet-button"
                          data-testid="button-decline-near-key-registration"
                          type="button"
                          onClick={() => setNearKeyRegistration(null)}
                          disabled={nearAuthLoading}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}
                  {(quoteState.status === 'ready' || quoteState.status === 'error') &&
                    nearSession && (
                      <div className="quote-action-row">
                        <button
                          className="primary-button"
                          data-testid="button-request-confidential-quote"
                          type="button"
                          onClick={() => requestDemoQuote(quoteState.commitmentId)}
                        >
                          {quoteState.status === 'error' ? 'Retry dry-run quote' : 'Request confidential dry-run quote'}
                        </button>
                      </div>
                    )}
                  {quoteState.status === 'ready' && !nearSession && !nearKeyRegistration && (
                    <p className="quote-result" role="status" data-testid="status-near-auth-required">
                      Authenticate with a NEAR wallet before requesting this confidential quote.
                    </p>
                  )}
                  {quoteState.status === 'ready' &&
                    nearSession &&
                    nearSession.expiresAt <= Date.now() && (
                    <p className="quote-result quote-result-error" role="alert">
                      This NEAR wallet session has expired. Authenticate again to continue.
                    </p>
                  )}
                  {quoteState.status === 'loading' && (
                    <p className="quote-result" role="status" data-testid="status-quote-loading">
                      Requesting a dry-run quote with fixed synthetic values…
                    </p>
                  )}
                  {quoteState.status === 'error' && (
                    <p className="quote-result quote-result-error" role="alert" data-testid="status-quote-error">
                      {quoteState.error}
                    </p>
                  )}
                  {quoteState.status === 'success' && (
                    <div className="quote-result" role="status" data-testid="status-quote-result">
                      <p>
                        Input: {formatUsdcBaseUnits(quoteState.result.inputAmount)} {quoteState.result.inputSymbol}
                      </p>
                      <p>
                        Quoted output: {formatUsdcBaseUnits(quoteState.result.outputAmount)} {quoteState.result.outputSymbol}
                      </p>
                      {quoteState.result.quoteId && <p>Quote reference: {quoteState.result.quoteId}</p>}
                      <p>Confidentiality requested: {quoteState.result.confidentialityRequested}</p>
                    </div>
                  )}
                  <div className="quote-warning">
                    The request uses a fixed synthetic 1 USDC and placeholder addresses. It does not send this commitment’s identifier or amount. A quote is not a signed swap or settlement.
                  </div>
                </div>
              </section>
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
                  ? `Claimed by ${raise.claimantName ?? raise.claim?.founderName ?? ''}`
                  : 'Public aggregate view'}
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
                  <label className="field-label" htmlFor="raise-claim-signature-account">Signature or account (optional)</label>
                  <input
                    className="field"
                    id="raise-claim-signature-account"
                    data-testid="input-raise-claim-signature-account"
                    name="signatureOrAccount"
                    type="text"
                    maxLength={500}
                    value={claimSignatureOrAccount}
                    onChange={(event) => setClaimSignatureOrAccount(event.target.value)}
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
                  <div className="aggregate-label">Progress toward {usd(target)}</div>
                  <div className="progress-total">{usd(hardTotal)}</div>
                </div>
                <div className="progress-target"><strong>{progress.toFixed(1)}%</strong><br />of {usd(target)}</div>
              </div>
              <div
                className="progress-line"
                data-testid="progress-hard-total"
                role="progressbar"
                aria-label={`Progress toward ${usd(target)}`}
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={Math.min(hardTotal, target)}
              >
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-scale"><span>$0</span><span>{usd(target)}</span></div>
              <div className="aggregate-grid">
                <div className="aggregate">
                  <div className="aggregate-label">Soft total</div>
                  <div className="aggregate-value" data-testid="text-soft-total">{usd(softTotal)}</div>
                </div>
                <div className="aggregate">
                  <div className="aggregate-label">Hard total</div>
                  <div className="aggregate-value" data-testid="text-hard-total">{usd(hardTotal)}</div>
                </div>
              </div>
              <div className="aggregate testnet-transfer-count" data-testid="text-confirmed-testnet-transfers">
                <div className="aggregate-label">Confirmed testnet transfers</div>
                <div className="aggregate-value">{raise.confirmedTestnetTransfers ?? 0}</div>
              </div>
              <div className="share-row">
                <span className="share-note">The demo threshold is met at {usd(target)} in hard commitments. Reaching it does not trigger settlement.</span>
                <button className="quiet-button" data-testid="button-copy-share-url" type="button" onClick={copyShareUrl}>
                  Copy share URL <span className="button-arrow" aria-hidden="true">↗</span>
                </button>
              </div>
              <div className="toast-message" data-testid="status-share-url" aria-live="polite">{shareMessage}</div>
              <button
                className="quiet-button near-demo-open"
                data-testid="button-open-near-demo"
                type="button"
                onClick={openNearDemo}
              >
                Open NEAR demo
              </button>
            </div>
          </section>
        )}

        {view === 'how' && (
          <section className="view-content how-panel" key="how">
            <article className="how-copy">
              <h1 className="how-title">How the app works</h1>
              <p>Agent Raised is a minimal demo of fundraise coordination with shared server-held records.</p>
              <p>
                A prospect submits a soft commitment, and a founder can claim a raise with contact details. New raises stay out of the public list until a founder approves them. The Founder view uses a shared approval code to access individual commitments and claim contact details. Marking a commitment hard enables a dry-run NEAR Intents quote with fixed synthetic values; the quote never executes a swap. Separately, the founder and investor can confirm an optional transfer of exactly 1 test USDC on NEAR testnet.
              </p>
              <p>
                Public pages and API responses show approved raise information, aggregate soft and hard USD totals, and an anonymous count of confirmed testnet transfers. Individual commitment identifiers, amounts, and claim contact details are not included in public responses.
              </p>
              <p>
                The pre-seeded raises and commitments are synthetic; do not enter sensitive real prospect information. Demo records are stored in PostgreSQL and persist across API restarts. Public pages show aggregate USD soft and hard totals plus an anonymous count of server-confirmed testnet transfers. Investor identifiers, amounts, and names stay private. Test USDC has no real value and does not change USD commitment totals.
              </p>
            </article>
          </section>
        )}

        {view === 'thesis' && (
          <section className="view-content thesis-panel" key="thesis">
            <article className="thesis-copy">
              {isFundThesis ? (
                <>
              <h1 className="thesis-title">Agent Raised — Example Thesis Summary</h1>
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
                <p>Minimum target example: $2 million.</p>
                <p>Maximum example: $5 million.</p>
                <p>Simple fee and carry terms can be applied.</p>
                <p>Lock-up and term are contractual.</p>
                <p>All figures and terms in this document are synthetic examples for the demo.</p>
              </div>

              <p>
                This page is context for the Agent Raised prototype only. It demonstrates shared demo commitment tracking and an illustrative NEAR Intents quote; the quote does not execute cross-chain settlement. It is not a solicitation.
              </p>
              <p>
                The form below only displays a local demo confirmation. It does not send a contact request or create a commitment.
              </p>
                </>
              ) : (
                <>
                  <h1 className="thesis-title">{raise.companyName} — Investment thesis</h1>
                  <p className="thesis-disclaimer">(Demo context only. Synthetic. Not an offer.)</p>
                  <section className="raise-thesis-block" data-testid="raise-specific-thesis">
                    <p>{raise.investmentThesis}</p>
                  </section>
                </>
              )}
            </article>

            {isFundThesis && (contactSubmitted ? (
              <p className="thesis-confirmation" data-testid="status-contact-request" role="status">
                Demo confirmation shown; no request was sent.
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
            ))}
          </section>
        )}

        {view === 'rules' && <RulesCalculator />}

      </main>
      <footer className="footer" data-testid="text-demo-label-footer">{DEMO_LABEL}</footer>
    </div>
  );
}

function Router() {
  const [loaded] = useState(loadRaises);
  const [raises, setRaises] = useState<Raise[]>(loaded.raises);
  const raisesRef = useRef<Raise[]>(loaded.raises);
  const [storageError, setStorageError] = useState(loaded.error);
  const [syncError, setSyncError] = useState('');

  function saveRaiseState(next: Raise[]) {
    raisesRef.current = next;
    setRaises(next);
    try {
      saveRaises(next);
      setStorageError('');
    } catch {
      setStorageError('Could not cache raise data in this browser.');
    }
  }

  function applyApiList(summaries: RaiseSummary[]) {
    saveRaiseState(mergeApiRaises(summaries, raisesRef.current));
  }

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const summaries = await getRaisesApi();
        if (!active) return;
        applyApiList(summaries);
        setSyncError('');
      } catch (error) {
        if (active) {
          setSyncError(requestErrorMessage(error, 'Shared raise data could not be loaded.'));
        }
      }
    }

    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  function applyApiRaise(summary: RaiseSummary) {
    const current = raisesRef.current;
    const existing = current.find((raise) => raise.id === summary.id);
    const base =
      existing ??
      INITIAL_RAISES.find((raise) => raise.id === summary.id) ?? {
        id: summary.id,
        companyName: summary.name,
        thesis: summary.thesis,
        investmentThesis: summary.thesis,
        stage: summary.stage,
        roundRange: summary.range,
        claimed: summary.claimed,
      };
    const updated = mergeApiRaise(summary, base);
    const next = existing
      ? current.map((raise) => raise.id === summary.id ? updated : raise)
      : [...current, updated];
    saveRaiseState(next);
  }

  function updateLocalRaise(id: string, update: (raise: Raise) => Raise) {
    saveRaiseState(raisesRef.current.map((raise) =>
      raise.id === id ? update(raise) : raise
    ));
  }

  async function refreshPublicRaises() {
    applyApiList(await getRaisesApi());
    setSyncError('');
  }

  async function submitClaim(id: string, claim: ClaimRaiseInput) {
    applyApiRaise(await claimRaiseApi(id, claim));
    updateLocalRaise(id, (raise) => ({
      ...raise,
      claimed: true,
      claimantName: claim.founderName,
      claim: {
        founderName: claim.founderName,
        email: claim.email,
        ...(claim.signatureOrAccount ? { signatureOrAccount: claim.signatureOrAccount } : {}),
      },
    }));
  }

  async function submitCommitment(id: string, identifier: string, amount: number) {
    const commitmentId = crypto.randomUUID();
    const demoReceipt = newDemoReceipt();
    applyApiRaise(await submitSoftCommitmentApi(id, { id: commitmentId, identifier, amount, demoReceipt }));
    rememberDemoReceipt(id, commitmentId, demoReceipt);
    updateLocalRaise(id, (raise) => ({
      ...raise,
      commitments: [
        ...(raise.commitments ?? []),
        { id: commitmentId, identifier, amount, hard: false, verified: false },
      ],
    }));
  }

  async function getPrivateRaiseForSponsor(id: string, approvalCode: string) {
    const options = { headers: { Authorization: `Bearer ${approvalCode}` } };
    let details = await getPrivateRaiseApi(id, options);
    const localRaise = raisesRef.current.find((raise) => raise.id === id);
    if (!localRaise) return details;

    if (localRaise.claim && !details.claim) {
      try {
        applyApiRaise(await claimRaiseApi(id, {
          founderName: localRaise.claim.founderName,
          email: localRaise.claim.email,
          ...(localRaise.claim.signatureOrAccount
            ? { signatureOrAccount: localRaise.claim.signatureOrAccount }
            : {}),
        }));
      } catch (error) {
        if (!isHttpStatus(error, 409)) throw error;
      }
    }

    for (const localCommitment of localRaise.commitments ?? []) {
      let existing = details.commitments.find((item) => item.id === localCommitment.id);
      if (!existing) {
        const summary = await submitSoftCommitmentApi(id, {
          id: localCommitment.id,
          identifier: localCommitment.identifier,
          amount: localCommitment.amount,
        });
        applyApiRaise(summary);
        existing = {
          id: localCommitment.id,
          identifier: localCommitment.identifier,
          amount: localCommitment.amount,
          hard: false,
          verified: false,
        };
      }
      if (
        (localCommitment.hard && !existing.hard) ||
        (localCommitment.verified && !existing.verified)
      ) {
        applyApiRaise(await updateRaiseCommitmentApi(
          id,
          localCommitment.id,
          {
            hard: true,
            verified: Boolean(localCommitment.verified),
          },
          options,
        ));
      }
    }

    details = await getPrivateRaiseApi(id, options);
    return details;
  }

  async function updateCommitment(
    id: string,
    commitmentId: string,
    status: CommitmentStatusInput,
    approvalCode: string,
  ) {
    const summary = await updateRaiseCommitmentApi(id, commitmentId, status, {
      headers: { Authorization: `Bearer ${approvalCode}` },
    });
    applyApiRaise(summary);
    updateLocalRaise(id, (raise) => ({
      ...raise,
      commitments: (raise.commitments ?? []).map((item) =>
        item.id === commitmentId ? { ...item, ...status } : item
      ),
      softTotal: summary.softTotal,
      hardTotal: summary.hardTotal,
    }));
  }

  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      {storageError && <p className="frame" role="alert">{storageError}</p>}
      {syncError && <p className="frame" role="alert">{syncError}</p>}
      <Switch>
        <Route path="/why-near"><WhyNearPage /></Route>
        <Route path="/roadmap"><RoadmapPage /></Route>
        <Route path="/">
          <RaiseList raises={raises} onApproved={refreshPublicRaises} />
        </Route>
        <Route path="/raises/:id">
          {(params) => {
            const raise = raises.find((item) => item.id === params.id);
            if (!raise) return <NotFound />;
            return (
              <AppDesk
                key={raise.id}
                raise={raise}
                onClaimRaise={(claim) => submitClaim(raise.id, claim)}
                onSubmitSoftCommitment={(identifier, amount) => submitCommitment(raise.id, identifier, amount)}
                onGetPrivateRaise={(approvalCode) => getPrivateRaiseForSponsor(raise.id, approvalCode)}
                onUpdateCommitment={(commitmentId, status, approvalCode) =>
                  updateCommitment(raise.id, commitmentId, status, approvalCode)
                }
                onRequestDemoQuote={(commitmentId, approvalCode, userSessionToken) =>
                  requestDemoQuoteApi(raise.id, commitmentId, {
                    headers: {
                      Authorization: `Bearer ${approvalCode}`,
                      'X-NEAR-User-Session': userSessionToken,
                    },
                  })
                }
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
