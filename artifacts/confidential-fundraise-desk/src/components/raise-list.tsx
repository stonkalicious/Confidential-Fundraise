import { type FormEvent, useState } from 'react';
import {
  submissionErrorsFromResponse,
  type SubmissionErrors,
  type SubmissionField,
} from '@workspace/api-zod/raise-submission';
import {
  approveRaise as approveRaiseApi,
  getPendingRaises as getPendingRaisesApi,
  submitRaise as submitRaiseApi,
  type PendingRaise,
} from '@workspace/api-client-react';
import { Link } from 'wouter';
import { getSafeSourceLink, RAISE_CATEGORIES, type Raise, type RaiseCategory } from '@/data/raises';
import SiteHeader from '@/components/site-header';
import { validateRaiseForm } from '@/lib/raise-submission';

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

const format = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
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
  const [fieldErrors, setFieldErrors] = useState<SubmissionErrors>({});
  const [selectedCategory, setSelectedCategory] = useState<RaiseCategory | null>(null);

  function clearFieldError(field: SubmissionField) {
    setSubmissionError('');
    setFieldErrors((errors) => {
      const updated = { ...errors };
      delete updated[field];
      if (field === 'rangeMin') delete updated.rangeMax;
      return updated;
    });
  }

  function showFieldErrors(errors: SubmissionErrors, form: HTMLFormElement) {
    setFieldErrors(errors);
    const first = Object.keys(errors)[0] as SubmissionField | undefined;
    const ids = { name: 'raise-name', thesis: 'raise-thesis', stage: 'raise-stage',
      rangeMin: 'raise-range-min', rangeMax: 'raise-range-max' };
    if (first) form.querySelector<HTMLElement>(`#${ids[first]}`)?.focus();
  }

  function errorProps(field: SubmissionField) {
    return {
      'aria-invalid': fieldErrors[field] ? true as const : undefined,
      'aria-describedby': fieldErrors[field] ? `raise-error-${field}` : undefined,
    };
  }

  function fieldError(field: SubmissionField) {
    return fieldErrors[field] && (
      <p className="inline-error" id={`raise-error-${field}`} role="alert">{fieldErrors[field]}</p>
    );
  }

  const [approvalCode, setApprovalCode] = useState('');
  const [pendingRaises, setPendingRaises] = useState<PendingRaise[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [approvingId, setApprovingId] = useState('');

  async function submitRaise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    setSubmissionError('');
    setSubmissionMessage('');
    const { input, errors } = validateRaiseForm({ name, thesis, stage, rangeMin, rangeMax });
    showFieldErrors(errors, form);
    if (Object.keys(errors).length > 0) {
      return;
    }
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
      const errors = submissionErrorsFromResponse(
        error && typeof error === 'object' && 'data' in error ? error.data : undefined,
      );
      showFieldErrors(errors, form);
      if (Object.keys(errors).length === 0) {
        setSubmissionError(errorMessage(error, 'The raise could not be submitted.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function loadPendingRaises(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingError('');
    if (!approvalCode) {
      setPendingError('Enter the founder approval code.');
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

  const visibleRaises = selectedCategory
    ? raises.filter((raise) => raise.categories?.includes(selectedCategory))
    : raises;

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="frame">
        <div className="raise-home-grid">
          <section className="raise-list-column">
            <h1 className="section-title">Active raises</h1>
            <div className="raise-category-filters" role="group" aria-label="Categories">
              <button
                className="raise-category-filter"
                type="button"
                aria-pressed={selectedCategory === null}
                onClick={() => setSelectedCategory(null)}
              >
                All
              </button>
              {RAISE_CATEGORIES.map((category) => (
                <button
                  className="raise-category-filter"
                  key={category.id}
                  type="button"
                  aria-pressed={selectedCategory === category.id}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <ul className="raise-list" data-testid="raise-list">
              {visibleRaises.map((raise) => {
                const sourceLink = getSafeSourceLink(raise.sourceLink);
                return (
                  <li key={raise.id}>
                    <Link className="raise-list-item" href={`/raises/${raise.id}`} data-testid={`raise-${raise.id}`}>
                      <div>
                        <h2 className="section-title">{raise.companyName}</h2>
                        <p className="section-copy">{raise.thesis}</p>
                        {raise.categories && raise.categories.length > 0 && (
                          <div className="raise-category-tags">
                            {raise.categories.map((categoryId) => {
                              const category = RAISE_CATEGORIES.find(({ id }) => id === categoryId);
                              return category ? (
                                <span className="raise-category-tag" key={category.id}>{category.label}</span>
                              ) : null;
                            })}
                          </div>
                        )}
                        <div className="raise-details">
                          {raise.stage} · {format(raise.roundRange.min)} – {format(raise.roundRange.max)}
                        </div>
                        {raise.rangeIsIndicative && (
                          <div className="raise-details">Approximate range; not a verified fundraising ask.</div>
                        )}
                        <div className="raise-details" data-testid={`raise-aggregate-${raise.id}`}>
                          Soft {format(raise.softTotal ?? 0)} · Hard {format(raise.hardTotal ?? 0)} ·
                          {' '}{raise.confirmedTestnetTransfers ?? 0} confirmed testnet transfers
                        </div>
                      </div>
                      <span className="raise-list-status">
                        {raise.claimed
                          ? `Claimed by ${raise.claimantName ?? raise.claim?.founderName ?? ''}`
                          : 'Public raise overview'} <span aria-hidden="true">↗</span>
                      </span>
                    </Link>
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
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="raise-submission-column">
            <section className="raise-submit-card raise-how-card" aria-labelledby="raise-how-title">
              <h2 className="section-title" id="raise-how-title">How it works</h2>
              <ol className="raise-how-steps">
                <li>
                  <h3>Find a raise</h3>
                  <p>Browse public raises, or submit your own for approval.</p>
                </li>
                <li>
                  <h3>Express interest privately</h3>
                  <p>
                    Add a soft commitment. Public pages show aggregate totals, not individual commitment details.
                  </p>
                </li>
                <li>
                  <Link className="raise-how-link" href="/why-near" data-testid="link-how-near">
                    Use Near to make the commitment real.
                  </Link>
                </li>
              </ol>
            </section>
            <form className="raise-submit-card" onSubmit={submitRaise} noValidate>
              <h2 className="section-title">Submit a raise</h2>
              <div className="field-wrap">
                <label className="field-label" htmlFor="raise-name">Raise name</label>
                <input
                  className="field"
                  id="raise-name"
                  data-testid="input-raise-name"
                  value={name}
                  onChange={(event) => { setName(event.target.value); clearFieldError('name'); }}
                  {...errorProps('name')}
                  maxLength={120}
                  required
                />
                {fieldError('name')}
              </div>
              <div className="field-wrap">
                <label className="field-label" htmlFor="raise-thesis">Short thesis</label>
                <textarea
                  className="field"
                  id="raise-thesis"
                  data-testid="input-raise-thesis"
                  rows={3}
                  value={thesis}
                  onChange={(event) => { setThesis(event.target.value); clearFieldError('thesis'); }}
                  {...errorProps('thesis')}
                  maxLength={280}
                  required
                />
                {fieldError('thesis')}
              </div>
              <div className="field-wrap">
                <label className="field-label" htmlFor="raise-stage">Stage</label>
                <input
                  className="field"
                  id="raise-stage"
                  data-testid="input-raise-stage"
                  value={stage}
                  onChange={(event) => { setStage(event.target.value); clearFieldError('stage'); }}
                  {...errorProps('stage')}
                  maxLength={60}
                  required
                />
                {fieldError('stage')}
              </div>
              <div className="raise-range-fields">
                <div className="field-wrap">
                  <label className="field-label" htmlFor="raise-range-min">Range minimum (USD)</label>
                  <input
                    className="field"
                    id="raise-range-min"
                    data-testid="input-raise-range-min"
                    type="number"
                    min="1"
                    step="1"
                    value={rangeMin}
                    onChange={(event) => { setRangeMin(event.target.value); clearFieldError('rangeMin'); }}
                    {...errorProps('rangeMin')}
                    required
                  />
                  {fieldError('rangeMin')}
                </div>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="raise-range-max">Range maximum (USD)</label>
                  <input
                    className="field"
                    id="raise-range-max"
                    data-testid="input-raise-range-max"
                    type="number"
                    min="1"
                    step="1"
                    value={rangeMax}
                    onChange={(event) => { setRangeMax(event.target.value); clearFieldError('rangeMax'); }}
                    {...errorProps('rangeMax')}
                    required
                  />
                  {fieldError('rangeMax')}
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
                <label className="field-label" htmlFor="raise-approval-code">Founder approval code</label>
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
