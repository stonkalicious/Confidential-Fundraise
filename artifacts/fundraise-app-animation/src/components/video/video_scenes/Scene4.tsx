import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { AppChrome, AppMasthead, AppTabs } from '../WalkthroughUI';

const EASE = [0.2, 0.85, 0.2, 1] as const;

export function Scene4() {
  const [verified, setVerified] = useState(false);
  const [totalStep, setTotalStep] = useState(0);
  const [conceal, setConceal] = useState(false);
  useSceneTimer([
    { time: 2050, callback: () => setVerified(true) },
    { time: 2950, callback: () => setTotalStep(1) },
    { time: 3250, callback: () => setTotalStep(2) },
    { time: 3550, callback: () => setTotalStep(3) },
    { time: 4350, callback: () => setConceal(true) },
  ]);
  const totals = ['$420,000', '$423,000', '$427,000', '$430,000'];
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, scale: 1.025 }}
      transition={{ duration: .38, ease: EASE }}
      style={{ background: '#eae8df' }}
    >
      <div className="mono" style={{ position: 'absolute', top: '5.5%', left: '6%', color: '#a45e49', fontSize: '2.8vmin' }}>03 / FOUNDER REVIEW</div>
      <div style={{ position: 'absolute', left: '6%', top: '11%', width: '88%', height: '78%', display: 'grid', gridTemplateColumns: '1.23fr .77fr' }}>
        <AppChrome style={{ height: '100%', background: '#39344d', borderColor: '#514b61' }}>
          <AppMasthead flag="PRIVATE VIEW" />
            <div className="app-content founder-content" style={{ paddingTop: '1.15vmin' }}>
            <AppTabs active="founder" />
            <div style={{ marginTop: '1.8vmin' }}>
              <div className="app-eyebrow">FOUNDER REVIEW · PRIVATE</div>
              <div className="ui-title" style={{ fontSize: '2.75vmin' }}>Review commitments</div>
              <div className="ui-note">Mark hard only after confirmation.</div>
              <motion.div
                animate={conceal ? { opacity: .95, x: '-1%' } : { opacity: 1, x: 0 }}
                transition={{ duration: .32 }}
                className="ledger-record"
                style={{ marginTop: '1.65vmin', padding: '1.6vmin 1.7vmin', position: 'relative' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div className="metric-label">SYNTHETIC IDENTIFIER</div>
                  <div className="serif" style={{ fontSize: '2.8vmin', marginTop: '.55vmin' }}>demo-investor-001</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="metric-label">SOFT COMMITMENT</div>
                  <div className="serif" style={{ fontSize: '2.8vmin', marginTop: '.45vmin' }}>$10,000</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1vmin', marginTop: '1.15vmin' }}>
                  {verified
                    ? <motion.span initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="status-stamp">HARD · VERIFIED (DEMO)</motion.span>
                    : <span className="note-tag mono" style={{ borderColor: '#696377', color: '#cec9d3' }}>SOFT</span>}
                  <motion.div
                    animate={verified ? { opacity: .45, scale: .97 } : { opacity: 1, scale: 1 }}
                    className="button-art" style={{ minHeight: '5.8vmin', fontSize: '2.8vmin', background: verified ? '#526b58' : '#f2efe6', color: verified ? '#f8f6ef' : '#39344d', border: '1px solid #cbc5b8' }}
                  >
                    {verified ? 'Verified (demo)' : 'Mark verified (demo)'}
                  </motion.div>
                </div>
                {conceal && <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: .35 }} style={{ position: 'absolute', inset: 0, background: '#39344d', transformOrigin: 'left', pointerEvents: 'none' }} />}
              </motion.div>
              <div className="mono" style={{ marginTop: '1.3vmin', fontSize: '2.8vmin', color: '#c4bfcb' }}>PRIVATE RECORDS · FOUNDER ACCESS ONLY</div>
            </div>
          </div>
        </AppChrome>
        <motion.div
          initial={{ opacity: 0, x: '5%' }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: .3, duration: .45, ease: EASE }}
          style={{ height: '100%', background: '#f8f6ef', border: '1px solid #d7d2c5', borderLeft: 0, padding: '4vmin 3.1vmin', display: 'flex', flexDirection: 'column' }}
        >
          <div className="mono" style={{ fontSize: '2.8vmin', color: '#a45e49' }}>PUBLIC AGGREGATE</div>
          <div className="serif" style={{ fontSize: '3.2vmin', marginTop: '1.25vmin' }}>Hard commitments</div>
          <motion.div
            key={totalStep}
            initial={{ opacity: .35, y: 7 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .24 }}
            className="serif" style={{ fontSize: '5vmin', marginTop: '1.65vmin', letterSpacing: '-.03em' }}
          >
            {totals[totalStep]}
          </motion.div>
          <div className="progress-track" style={{ marginTop: '1.5vmin', height: '.75vmin' }}>
            <motion.div className="progress-fill" initial={{ scaleX: .21 }} animate={{ scaleX: .21 + totalStep * .005 }} transition={{ duration: .5, ease: EASE }} style={{ height: '100%' }} />
          </div>
          <div className="mono metric-label" style={{ marginTop: '.8vmin', display: 'flex', justifyContent: 'space-between' }}><span>21%</span><span>TARGET $2M</span></div>
          <div className="divider" style={{ margin: '2.1vmin 0 1.3vmin' }} />
          <div className="ui-note">This view shows the updated total—not who committed.</div>
          <div style={{ marginTop: 'auto', color: '#8d8a7e', font: '2.8vmin/1.2 var(--mono)', textTransform: 'uppercase', letterSpacing: '.025em' }}>Demo status only.<br />No funds moved.</div>
        </motion.div>
      </div>
      <motion.div className="rule" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 4.88, duration: .5 }}
        style={{ left: '6%', bottom: '5.7%', width: '88%', height: '.18vmin' }} />
    </motion.section>
  );
}
