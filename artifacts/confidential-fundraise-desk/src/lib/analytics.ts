type AnalyticsData = Record<string, string | number | boolean>;

export type QuoteOutcome = 'success' | 'auth_required' | 'provider_error';

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function getQuoteFailureOutcome(error: unknown): Exclude<QuoteOutcome, 'success'> {
  if (!error || typeof error !== 'object' || !('data' in error)) return 'provider_error';

  const data = error.data;
  const message =
    data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : '';
  return /authenticate a near wallet|rejected the near wallet session/i.test(message)
    ? 'auth_required'
    : 'provider_error';
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never affect the app flow.
  }
}

export function trackQuoteOutcome(outcome: QuoteOutcome): void {
  trackEvent('quote_outcome', { outcome });
}
