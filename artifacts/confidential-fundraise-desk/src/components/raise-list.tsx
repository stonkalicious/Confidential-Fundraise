import { type FormEvent, useState } from 'react';
import {
  approveRaise as approveRaiseApi,
  getPendingRaises as getPendingRaisesApi,
  submitRaise as submitRaiseApi,
  type PendingRaise,
  type RaiseSubmissionInput,
} from '@workspace/api-client-react';
import { Link } from 'wouter';
import type { Raise } from '@/data/raises';
import SiteHeader from '@/components/site-header';

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

const format = (amount: number) => new Intl.NumberFormat('en-IE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(amount);

export default function RaiseList({
  raises,
  onApproved,
}: {
  raises: Raise[];
  onApproved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [thesis, setThesis] = useState('');
  const [stage, setStage] = useState('');
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [submissionError, setSubmissionError] = useState('');

  const [approvalCode, setApprovalCode] = useState('');
  const [pendingRaises, setPendingRaises] = useState<PendingRaise[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [approvingId, setApprovingId] = useState('');

  async function submitRaise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError('');
    setSubmissionMessage('');
    const min = Number(rangeMin);
    const max = Number(rangeMax);
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min <= 0 || max < min) {
      setSubmissionError('Enter a valid positive round range.');
      return;
    }

    const input: RaiseSubmissionInput = {
      name: name.trim(),
      thesis: thesis.trim(),
      stage: stage.trim(),
      range: { min, max },
    };
    setSubmitting(true);
    try {
      const receipt = await submitRaiseApi(input);
      setName('');
      setThesis('');
      setStage('');
      setRangeMin('');
      setRangeMax('');
      setSubmissionMessage(`Submitted for approval. Reference: ${receipt.id}`);
    } catch (error) {
      setSubmissionError(errorMessage(error, 'The raise could not be submitted.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function loadPendingRaises(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingError('');
    if (!approvalCode) {
      setPendingError('Enter the sponsor approval code.');
      return;
    }
    setLoadingPending(true);
    try {
      const items = await getPendingRaisesApi({
        headers: { Authorization: `Bearer ${approvalCode}` },
      });
      setPendingRaises(items);
    } catch (error) {
      setPendingRaises([]);
      setPendingError(errorMessage(error, 'Pending raises could not be loaded.'));
    } finally {
      setLoadingPending(false);
    }
  }

  async function approvePendingRaise(id: string) {
    setPendingError('');
    setApprovingId(id);
    try {
      await approveRaiseApi(id, {
        headers: { Authorization: `Bearer ${approvalCode}` },
      });
      await onApproved();
      setPendingRaises((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      setPendingError(errorMessage(error, 'The raise could not be approved.'));
    } finally {
      setApprovingId('');
    }
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="frame">
        <div className="raise-home-grid">
          <section className="raise-list-column">
            <h1 className="section-title">Raises</h1>
            <ul className="raise-list" data-testid="raise-list">
              {raises.map((raise) => (
                <li key={raise.id}>
                  <Link className="raise-list-item" href={`/raises/${raise.id}`} data-testid={`raise-${raise.id}`}>
                    <div>
                      <h2 className="section-title">{raise.companyName}</h2>
                      <p className="section-copy">{raise.thesis}</p>
                      <div className="raise-details">
                        {raise.stage} · {format(raise.roundRange.min)} – {format(raise.roundRange.max)}
                      </div>
                    </div>
                    <span className="raise-list-status">
                      {raise.claimed
                        ? `Claimed by ${raise.claimantName ?? raise.claim?.founderName ?? ''}`
                        : 'Public raise overview'} <span aria-hidden="true">↗</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <aside className="raise-submission-column">
            <form className="raise-submit-card" onSubmit={submitRaise}>
              <h2 className="section-title">Submit a raise</h2>
              <div className="field-wrap">
                <label className="field-label" htmlFor="raise-name">Raise name</label>
                <input
                  className="field"
                  id="raise-name"
                  data-testid="input-raise-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  required
                />
              </div>
              <div className="field-wrap">
                <label className="field-label" htmlFor="raise-thesis">Short thesis</label>
                <textarea
                  className="field"
                  id="raise-thesis"
                  data-testid="input-raise-thesis"
                  rows={3}
                  value={thesis}
                  onChange={(event) => setThesis(event.target.value)}
                  maxLength={280}
                  required
                />
              </div>
              <div className="field-wrap">
                <label className="field-label" htmlFor="raise-stage">Stage</label>
                <input
                  className="field"
                  id="raise-stage"
                  data-testid="input-raise-stage"
                  value={stage}
                  onChange={(event) => setStage(event.target.value)}
                  maxLength={60}
                  required
                />
              </div>
              <div className="raise-range-fields">
                <div className="field-wrap">
                  <label className="field-label" htmlFor="raise-range-min">Range minimum (EUR)</label>
                  <input
                    className="field"
                    id="raise-range-min"
                    data-testid="input-raise-range-min"
                    type="number"
                    min="1"
                    step="1"
                    value={rangeMin}
                    onChange={(event) => setRangeMin(event.target.value)}
                    required
                  />
                </div>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="raise-range-max">Range maximum (EUR)</label>
                  <input
                    className="field"
                    id="raise-range-max"
                    data-testid="input-raise-range-max"
                    type="number"
                    min="1"
                    step="1"
                    value={rangeMax}
                    onChange={(event) => setRangeMax(event.target.value)}
                    required
                  />
                </div>
              </div>
              {submissionError && <p className="inline-error" role="alert">{submissionError}</p>}
              {submissionMessage && <p className="form-status" role="status">{submissionMessage}</p>}
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit for approval'}
              </button>
              <p className="field-hint">New raises stay private until approved.</p>
            </form>

            <details className="pending-review">
              <summary>Review pending raises</summary>
              <form className="pending-review-form" onSubmit={loadPendingRaises}>
                <label className="field-label" htmlFor="raise-approval-code">Sponsor approval code</label>
                <input
                  className="field"
                  id="raise-approval-code"
                  data-testid="input-raise-approval-code"
                  type="password"
                  autoComplete="current-password"
                  value={approvalCode}
                  onChange={(event) => setApprovalCode(event.target.value)}
                />
                <button className="quiet-button" type="submit" disabled={loadingPending}>
                  {loadingPending ? 'Loading…' : 'Load pending'}
                </button>
              </form>
              {pendingError && <p className="inline-error" role="alert">{pendingError}</p>}
              {pendingRaises.length === 0 && !pendingError && (
                <p className="field-hint">No pending raises loaded.</p>
              )}
              <div className="pending-raise-list">
                {pendingRaises.map((raise) => (
                  <article className="pending-raise-item" key={raise.id}>
                    <h3>{raise.name}</h3>
                    <p>{raise.thesis}</p>
                    <div className="raise-details">
                      {raise.stage} · {format(raise.range.min)} – {format(raise.range.max)}
                    </div>
                    <button
                      className="mark-button"
                      type="button"
                      onClick={() => approvePendingRaise(raise.id)}
                      disabled={approvingId === raise.id}
                    >
                      {approvingId === raise.id ? 'Approving…' : 'Approve raise'}
                    </button>
                  </article>
                ))}
              </div>
            </details>
          </aside>
        </div>
      </main>
      <footer className="footer">Demo only — public pages show approved raises and aggregate totals.</footer>
    </div>
  );
}
