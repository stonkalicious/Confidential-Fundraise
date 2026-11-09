import { useEffect, useRef, useState } from 'react';
import {
  getDemoSettlement, getDemoSettlementConfig, configureDemoSettlement,
  confirmDemoSettlement, prepareDemoSettlement, verifyDemoSettlement,
  type DemoSettlement, type DemoSettlementConfig,
} from '@workspace/api-client-react';
import {
  connectSettlementWallet, sendDemoUsdc, demoReceipts,
  savedDemoAttempt, saveDemoAttempt, type InvestorDemoReceipt,
} from '@/lib/demo-settlement-wallet';

const CONFIRMATION = 'I confirm I have reviewed the terms of this transfer and understand this is a demo settlement.';
function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return error instanceof Error ? error.message : 'The demo settlement could not be completed.';
}

export function InvestorDemoSettlements({ raiseId }: { raiseId: string }) {
  const [receipts, setReceipts] = useState(() => demoReceipts(raiseId));
  useEffect(() => {
    const update = () => setReceipts(demoReceipts(raiseId));
    update();
    window.addEventListener('demo-receipts-changed', update);
    return () => window.removeEventListener('demo-receipts-changed', update);
  }, [raiseId]);
  return <>{receipts.map((receipt) =>
    <DemoSettlementCard key={receipt.commitmentId} raiseId={raiseId}
      commitmentId={receipt.commitmentId} receipt={receipt} />,
  )}</>;
}

export function DemoSettlementCard({
  raiseId, commitmentId, approvalCode, receipt,
}: {
  raiseId: string; commitmentId: string; approvalCode?: string; receipt?: InvestorDemoReceipt;
}) {
  const sponsor = approvalCode !== undefined;
  const [open, setOpen] = useState(false);
  const [exists, setExists] = useState(sponsor);
  const [settlement, setSettlement] = useState<DemoSettlement>();
  const [config, setConfig] = useState<DemoSettlementConfig>();
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [receiver, setReceiver] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [account, setAccount] = useState('');
  const [hash, setHash] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const options = (): { headers: Record<string, string> } => ({ headers: sponsor
    ? { Authorization: `Bearer ${approvalCode}` }
    : { 'X-Demo-Receipt': receipt?.token ?? '' } });

  function apply(next?: DemoSettlement) {
    setSettlement(next);
    if (next) {
      const saved = savedDemoAttempt(next);
      setAttempted(Boolean(saved) || next.status === 'prepared' || next.status === 'success');
      if (saved && saved !== 'unknown') setHash(saved);
    }
  }

  useEffect(() => {
    let active = true;
    async function refresh() {
      // Never erase an existing result or change investor review state on an
      // intermittent polling failure.
      try {
        const result = await getDemoSettlement(raiseId, commitmentId, options());
        if (active) { setExists(true); apply(result.settlement); }
      } catch (e) {
        if (active && open) setError(errorText(e));
      }
    }
    void refresh();
    const interval = open ? window.setInterval(() => { void refresh(); }, 5000) : undefined;
    return () => { active = false; if (interval) window.clearInterval(interval); };
  }, [raiseId, commitmentId, approvalCode, receipt?.token, open]);

  useEffect(() => {
    if (!open || !sponsor) return;
    let active = true;
    void getDemoSettlementConfig().then((value) => { if (active) setConfig(value); })
      .catch((e) => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [open, sponsor]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(errorText(e)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function connect() {
    if (!settlement) return;
    const connected = await connectSettlementWallet(settlement.network);
    if (settlement.signerAccount && connected !== settlement.signerAccount) {
      throw new Error('Reconnect the same investor account that confirmed this demo transfer.');
    }
    setAccount(connected);
  }
  async function send() {
    if (!settlement || !account || !confirmed ||
        settlement.signerAccount && settlement.signerAccount !== account) return;
    const checked = await confirmDemoSettlement(raiseId, commitmentId, {
      settlementId: settlement.id, signerAccount: account, confirmed: true,
    }, options());
    apply(checked.settlement);
    const prepared = await prepareDemoSettlement(raiseId, commitmentId, options());
    if (!prepared.settlement) throw new Error('No prepared demo transfer was returned.');
    const next = prepared.settlement;
    // An existing prepared intent could already have been sent from another
    // tab/session. Never automatically issue a second wallet request.
    if (!prepared.maySend || next.status === 'success' || settlement.status === 'prepared' ||
        savedDemoAttempt(next)) {
      apply(next); throw new Error('This demo transfer may already have been sent. Check its transaction hash; do not send again.');
    }
    saveDemoAttempt(next);
    setAttempted(true);
    const txHash = await sendDemoUsdc(next);
    setHash(txHash);
    try { saveDemoAttempt(next, txHash); } catch { /* The durable "unknown" guard already prevents another send. */ }
    const verified = await verifyDemoSettlement(raiseId, commitmentId, { transactionHash: txHash }, options());
    apply(verified.settlement);
  }

  if (!exists) return null;
  return (
    <section className="demo-settlement" data-testid={sponsor ? 'sponsor-demo-settlement' : 'investor-demo-settlement'}>
      <button type="button" className="quiet-button" aria-expanded={open}
        data-testid="button-open-demo-settlement" onClick={() => setOpen(!open)}>
        Settle $1 (demo)
      </button>
      {open && <div className="demo-settlement-body">
        <h3>Demo settlement — 1 USDC</h3>
        <p className="side-copy">Optional direct NEAR token transfer. This is not an Intents swap and does not change commitment totals or fund rights.</p>
        {!sponsor && receipt && !receipt.persisted &&
          <p className="inline-error">This browser could not save your demo receipt. Keep this tab open; reloading may lose access.</p>}
        {sponsor && !settlement && <>
          <label className="field-label">Demo network
            <select className="field" value={network} disabled={busy}
              data-testid="select-demo-network"
              onChange={(e) => { setNetwork(e.target.value as typeof network); setConfirmed(false); }}>
              <option value="testnet">NEAR testnet — test USDC, no real value</option>
              <option value="mainnet">NEAR mainnet — real 1 USDC fallback</option>
            </select>
          </label>
          <p className="side-copy demo-break">Token contract: {config?.[network] ?? 'Loading…'}</p>
          <label className="field-label">Receiving NEAR account
            <input className="field" value={receiver} maxLength={64} disabled={busy}
              data-testid="input-demo-receiver" placeholder={network === 'testnet' ? 'sponsor.testnet' : 'sponsor.near'}
              onChange={(e) => { setReceiver(e.target.value); setConfirmed(false); }} />
          </label>
          <label className="field-label">Reviewed link or document hash (optional)
            <input className="field" value={reference} maxLength={300} disabled={busy}
              data-testid="input-demo-reference"
              onChange={(e) => { setReference(e.target.value); setConfirmed(false); }} />
          </label>
          <p className="side-copy">Paste only a reference you have already reviewed. No files are uploaded or parsed. The receiver must already be registered with this USDC contract.</p>
          <p className="side-copy">{network === 'testnet'
            ? 'Demo: 1 test USDC has no dollar value. Gas uses test NEAR.'
            : 'Mainnet demo: this sends real 1 USDC, plus a small NEAR deposit and gas. Transfers are irreversible.'}</p>
          <label className="demo-confirm">
            <input type="checkbox" checked={confirmed} disabled={busy}
              data-testid="checkbox-sponsor-demo" onChange={(e) => setConfirmed(e.target.checked)} />
            <span>{CONFIRMATION}</span>
          </label>
          <button type="button" className="mark-button" disabled={busy || !confirmed || !receiver.trim() || !config}
            data-testid="button-confirm-sponsor-demo" onClick={() => void run(async () => {
              const result = await configureDemoSettlement(raiseId, commitmentId, {
                network, receiverAccount: receiver.trim(), ...(reference.trim() ? { reference: reference.trim() } : {}),
                confirmed: true,
              }, options());
              apply(result.settlement); setConfirmed(false);
            })}>Confirm sponsor review</button>
        </>}
        {!settlement && !sponsor && <p className="side-copy">Waiting for the sponsor to set the receiving account and confirm this demo transfer. Keep using the browser where you submitted your commitment.</p>}
        {settlement && <>
          <p className="side-copy"><strong>{settlement.network === 'testnet'
            ? 'NEAR testnet — 1 test USDC, no real dollar value.'
            : 'NEAR mainnet — real 1 USDC. NEAR gas is additional; transfers are irreversible.'}</strong></p>
          <p className="side-copy demo-break">Token contract: {settlement.tokenContract}<br />
            Receiver: {settlement.receiverAccount}
            {settlement.signerAccount && <><br />Sender: {settlement.signerAccount}</>}
          </p>
          {settlement.reference && <p className="side-copy demo-break">Reviewed reference: {
            /^https?:\/\//.test(settlement.reference)
              ? <a href={settlement.reference} target="_blank" rel="noopener noreferrer">{settlement.reference}</a>
              : settlement.reference
          }</p>}
          <ul className="demo-audit" data-testid="demo-confirmations">
            {settlement.confirmations.map((entry) =>
              <li key={entry.role}>{entry.role === 'sponsor' ? 'Sponsor' : 'Investor'} confirmed: {new Date(entry.timestamp).toLocaleString()}</li>)}
          </ul>
          {settlement.status === 'success' ? (
            <p className="side-copy demo-break" role="status" data-testid="demo-settlement-success">
              Demo transfer confirmed.<br />
              Transaction hash: <a href={`https://${settlement.network === 'testnet' ? 'testnet.' : ''}nearblocks.io/txns/${settlement.transactionHash}`}
                target="_blank" rel="noopener noreferrer">{settlement.transactionHash}</a>
            </p>
          ) : !sponsor && <>
            <p className="side-copy">You need 1 {settlement.network === 'testnet' ? 'test ' : ''}USDC on NEAR and NEAR for gas. Both reviews apply to the fixed details above. The wallet asks for your approval; the app never holds your keys.</p>
            {!attempted && <>
              <button type="button" className="quiet-button" disabled={busy}
                data-testid="button-connect-demo-wallet" onClick={() => void run(connect)}>
                {account ? `Wallet: ${account}` : `Connect ${settlement.network} NEAR wallet`}
              </button>
              <label className="demo-confirm">
                <input type="checkbox" checked={confirmed} disabled={busy}
                  data-testid="checkbox-investor-demo" onChange={(e) => setConfirmed(e.target.checked)} />
                <span>{CONFIRMATION}</span>
              </label>
              <button type="button" className="mark-button" disabled={busy || !confirmed || !account}
                data-testid="button-send-demo-usdc" onClick={() => void run(send)}>
                {busy ? 'Preparing demo transfer…' : `Send 1 ${settlement.network === 'testnet' ? 'test ' : ''}USDC (demo)`}
              </button>
            </>}
            {attempted && <>
              <p className="side-copy">A wallet transfer may already have been requested. Do not send again. Check your wallet, then verify its transaction hash below. If you rejected it, no funds were sent.</p>
              <label className="field-label">Demo transaction hash
                <input className="field" value={hash} maxLength={50}
                  data-testid="input-demo-transaction-hash" onChange={(e) => setHash(e.target.value.trim())} />
              </label>
              <button type="button" className="quiet-button" disabled={busy || !hash}
                data-testid="button-verify-demo-transfer" onClick={() => void run(async () => {
                  const result = await verifyDemoSettlement(raiseId, commitmentId, { transactionHash: hash }, options());
                  apply(result.settlement);
                })}>Check demo transaction</button>
            </>}
          </>}
          {sponsor && settlement.status !== 'success' && <p className="side-copy">Waiting for the investor to confirm and complete the demo transfer from their original browser.</p>}
        </>}
        {error && <p className="inline-error" role="alert" data-testid="demo-settlement-error">{error}</p>}
      </div>}
    </section>
  );
}
