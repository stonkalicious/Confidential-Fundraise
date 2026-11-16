import { validateRaiseSubmission } from '@workspace/api-zod/raise-submission';

export function validateRaiseForm(values: {
  name: string; thesis: string; stage: string; rangeMin: string; rangeMax: string; sourceLink: string;
}) {
  // Match number inputs, without introducing formatted currency or other radices.
  const number = (value: string) =>
    /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ? Number(value) : NaN;
  return validateRaiseSubmission({
    name: values.name,
    thesis: values.thesis,
    stage: values.stage,
    range: { min: number(values.rangeMin), max: number(values.rangeMax) },
    sourceLink: values.sourceLink,
  });
}
