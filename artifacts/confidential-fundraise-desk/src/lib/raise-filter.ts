export type InvestorTicketRange = {
  min?: number;
  max?: number;
};

export type InvestorTicketRangeResult = {
  range: InvestorTicketRange;
  error?: string;
};

function parseBound(value: string): number | undefined | null {
  if (value.trim() === '') return undefined;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function parseInvestorTicketRange(minValue: string, maxValue: string): InvestorTicketRangeResult {
  const min = parseBound(minValue);
  const max = parseBound(maxValue);

  if (min === null || max === null) {
    return { range: {}, error: 'Enter positive whole-dollar amounts.' };
  }
  if (min !== undefined && max !== undefined && min > max) {
    return { range: {}, error: 'Minimum ticket must not exceed maximum ticket.' };
  }

  return {
    range: {
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
    },
  };
}

export function raiseMatchesInvestorTicketRange(
  roundRange: { min: number; max: number },
  investorRange: InvestorTicketRange,
): boolean {
  if (investorRange.min !== undefined && roundRange.max < investorRange.min) return false;
  if (investorRange.max !== undefined && roundRange.min > investorRange.max) return false;
  return true;
}
