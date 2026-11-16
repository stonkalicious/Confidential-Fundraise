// Shared by the form and route. Keep these limits aligned with RaiseSubmissionInput.
export type SubmissionField = 'name' | 'thesis' | 'stage' | 'rangeMin' | 'rangeMax' | 'sourceLink';
export type SubmissionErrors = Partial<Record<SubmissionField, string>>;

const textRules = {
  name: { label: 'Raise name', min: 2, max: 120 },
  thesis: { label: 'Short thesis', min: 10, max: 280 },
  stage: { label: 'Stage', min: 1, max: 60 },
} as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isHttpUrl(value: string): boolean {
  return /^https:\/\/(?:\[[\da-f:.]+\]|[a-z\d](?:[a-z\d.-]*[a-z\d])?)(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value)
    || /^http:\/\/(?:\[[\da-f:.]+\]|[a-z\d](?:[a-z\d.-]*[a-z\d])?)(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value);
}

export function validateRaiseSubmission(value: unknown) {
  const body = record(value);
  const errors: SubmissionErrors = {};
  const text = { name: '', thesis: '', stage: '' };
  for (const field of ['name', 'thesis', 'stage'] as const) {
    const rule = textRules[field];
    const raw = body[field];
    text[field] = typeof raw === 'string' ? raw.trim() : '';
    if (typeof raw !== 'string') errors[field] = `Enter a valid ${rule.label.toLowerCase()}.`;
    else if (text[field].length < rule.min) {
      errors[field] = rule.min === 1 ? `${rule.label} is required.`
        : `${rule.label} must be at least ${rule.min} characters.`;
    } else if (text[field].length > rule.max) {
      errors[field] = `${rule.label} must be at most ${rule.max} characters.`;
    }
  }
  const range = record(body.range);
  const validMin = typeof range.min === 'number' && Number.isSafeInteger(range.min) && range.min > 0;
  const validMax = typeof range.max === 'number' && Number.isSafeInteger(range.max) && range.max > 0;
  if (!validMin) errors.rangeMin = 'Range minimum must be a positive safe whole number.';
  if (!validMax) errors.rangeMax = 'Range maximum must be a positive safe whole number.';
  if (validMin && validMax && (range.max as number) < (range.min as number)) {
    errors.rangeMax = 'Range maximum must be at least the minimum.';
  }
  const rawSourceLink = body.sourceLink;
  let sourceLink: string | undefined;
  if (rawSourceLink !== undefined) {
    if (typeof rawSourceLink !== 'string') {
      errors.sourceLink = 'Enter a valid HTTP or HTTPS source URL.';
    } else if (rawSourceLink.trim()) {
      sourceLink = rawSourceLink.trim();
      if (sourceLink.length > 2048) {
        errors.sourceLink = 'Source URL must be at most 2048 characters.';
      } else if (!isHttpUrl(sourceLink)) {
        errors.sourceLink = 'Enter a valid HTTP or HTTPS source URL.';
      }
    }
  }
  return {
    errors,
    input: {
      ...text,
      range: { min: range.min as number, max: range.max as number },
      ...(sourceLink && !errors.sourceLink ? { sourceLink } : {}),
    },
  };
}

// Only accept known field names and bounded messages, never raw validator details.
export function submissionErrorsFromResponse(value: unknown): SubmissionErrors {
  const fields = record(record(value).fieldErrors);
  const errors: SubmissionErrors = {};
  for (const field of ['name', 'thesis', 'stage', 'rangeMin', 'rangeMax', 'sourceLink'] as const) {
    const message = fields[field];
    if (typeof message === 'string' && message.trim() && message.length <= 160) {
      errors[field] = message;
    }
  }
  return errors;
}
