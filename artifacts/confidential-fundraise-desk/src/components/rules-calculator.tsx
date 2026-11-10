import { type FormEvent, useState } from 'react';

type CalculatorInputs = {
  ticketSize: string;
  totalProceeds: string;
  preferredReturn: string;
  sponsorCarry: string;
};

type WaterfallResult = {
  capitalReturned: number;
  preferredReturnAmount: number;
  remainder: number;
  sponsorAmount: number;
  investorAmount: number;
};

const DEFAULT_INPUTS: CalculatorInputs = {
  ticketSize: '100000',
  totalProceeds: '',
  preferredReturn: '6',
  sponsorCarry: '20',
};

const currency = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

function nonNegativeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function calculateWaterfall(inputs: CalculatorInputs): WaterfallResult {
  const ticketSize = nonNegativeNumber(inputs.ticketSize);
  const totalProceeds = nonNegativeNumber(inputs.totalProceeds);
  const preferredRate = nonNegativeNumber(inputs.preferredReturn) / 100;
  const sponsorCarryRate = Math.min(100, nonNegativeNumber(inputs.sponsorCarry)) / 100;

  const capitalReturned = Math.min(ticketSize, totalProceeds);
  const preferredReturnDue = ticketSize * preferredRate;
  const proceedsAfterCapital = Math.max(0, totalProceeds - capitalReturned);
  const preferredReturnAmount = Math.min(preferredReturnDue, proceedsAfterCapital);
  const remainder = Math.max(0, proceedsAfterCapital - preferredReturnAmount);
  const sponsorAmount = remainder * sponsorCarryRate;
  const investorAmount = remainder - sponsorAmount;

  return {
    capitalReturned,
    preferredReturnAmount,
    remainder,
    sponsorAmount,
    investorAmount,
  };
}

export default function RulesCalculator() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [results, setResults] = useState(() => calculateWaterfall(DEFAULT_INPUTS));

  function updateInput(field: keyof CalculatorInputs, value: string) {
    const nextInputs = { ...inputs, [field]: value };
    setInputs(nextInputs);
    setResults(calculateWaterfall(nextInputs));
  }

  function handleCalculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResults(calculateWaterfall(inputs));
  }

  return (
    <section className="view-content rules-calculator" key="rules">
      <div className="rules-explainer">
        <h1 className="rules-title">Mechanical distribution rules</h1>
        <p className="rules-demo">(Demo only — synthetic)</p>
        <div className="rules-explainer-copy">
          <p>This calculator shows how a simple set of mechanical rules can determine returns from a ticket size.</p>
          <p>Capital is returned first.</p>
          <p>A preferred return is applied next.</p>
          <p>Anything above that is split.</p>
          <p>No value moves. The numbers are illustrative only and exist to show that distribution logic can be expressed as clear, checkable rules rather than manual calculation.</p>
        </div>
      </div>

      <div className="rules-layout">
        <form className="form-card rules-inputs" onSubmit={handleCalculate} noValidate>
          <div className="field-wrap">
            <label className="field-label" htmlFor="rules-ticket-size">Ticket size (EUR)</label>
            <input
              className="field"
              id="rules-ticket-size"
              data-testid="input-rules-ticket-size"
              type="number"
              min="0"
              step="any"
              value={inputs.ticketSize}
              onChange={(event) => updateInput('ticketSize', event.target.value)}
            />
          </div>
          <div className="field-wrap">
            <label className="field-label" htmlFor="rules-total-proceeds">Total proceeds (EUR)</label>
            <input
              className="field"
              id="rules-total-proceeds"
              data-testid="input-rules-total-proceeds"
              type="number"
              min="0"
              step="any"
              value={inputs.totalProceeds}
              onChange={(event) => updateInput('totalProceeds', event.target.value)}
            />
          </div>
          <div className="field-wrap">
            <label className="field-label" htmlFor="rules-preferred-return">Preferred return (% simple)</label>
            <input
              className="field"
              id="rules-preferred-return"
              data-testid="input-rules-preferred-return"
              type="number"
              min="0"
              step="any"
              value={inputs.preferredReturn}
              onChange={(event) => updateInput('preferredReturn', event.target.value)}
            />
          </div>
          <div className="field-wrap">
            <label className="field-label" htmlFor="rules-sponsor-carry">Carry split to founder (%)</label>
            <input
              className="field"
              id="rules-sponsor-carry"
              data-testid="input-rules-sponsor-carry"
              type="number"
              min="0"
              max="100"
              step="any"
              value={inputs.sponsorCarry}
              onChange={(event) => updateInput('sponsorCarry', event.target.value)}
            />
          </div>
          <button className="primary-button" data-testid="button-calculate-rules" type="submit">
            Calculate
          </button>
        </form>

        <div className="rules-results" aria-live="polite">
          <div className="rules-result-row">
            <span>Capital returned</span>
            <strong data-testid="result-capital-returned">{currency.format(results.capitalReturned)}</strong>
          </div>
          <div className="rules-result-row">
            <span>Preferred return amount</span>
            <strong data-testid="result-preferred-return">{currency.format(results.preferredReturnAmount)}</strong>
          </div>
          <div className="rules-result-row">
            <span>Remainder after capital + preferred</span>
            <strong data-testid="result-remainder">{currency.format(results.remainder)}</strong>
          </div>
          <div className="rules-result-row">
            <span>Amount to founder (carry %)</span>
            <strong data-testid="result-sponsor-amount">{currency.format(results.sponsorAmount)}</strong>
          </div>
          <div className="rules-result-row">
            <span>Amount to investor (the rest)</span>
            <strong data-testid="result-investor-amount">{currency.format(results.investorAmount)}</strong>
          </div>
        </div>
      </div>

      <p className="rules-footer">These rules are synthetic examples for the demo. They are not an offer or a forecast.</p>
    </section>
  );
}
