import type { NearDemoPanelState } from '@/lib/near-demo-panel';

export default function NearDemoPanel({ state }: { state: NearDemoPanelState }) {
  return (
    <section
      className="near-demo-panel"
      id="near-demo-panel"
      tabIndex={-1}
      aria-labelledby="near-demo-panel-title"
      data-testid="panel-near-demo"
    >
      <h3 id="near-demo-panel-title">NEAR Intents demo</h3>
      <dl className="near-demo-rows" aria-live="polite">
        <div><dt>Wallet authentication</dt><dd data-testid="text-near-demo-wallet">{state.wallet}</dd></div>
        <div><dt>Quote request</dt><dd data-testid="text-near-demo-quote">{state.quote}</dd></div>
        <div><dt>Example route</dt><dd data-testid="text-near-demo-route">1 USDC, Ethereum → Arbitrum</dd></div>
        <div><dt>Confidentiality requested</dt><dd data-testid="text-near-demo-confidentiality">{state.confidentiality}</dd></div>
      </dl>
      <p className="near-demo-disclaimer" data-testid="text-near-demo-disclaimer">Dry-run quote only. No swap is executed.</p>
    </section>
  );
}
