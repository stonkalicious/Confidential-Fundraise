import { motion } from 'framer-motion';
import { AppChrome, AppFootnote, AppMasthead, AppTabs } from '../WalkthroughUI';

const EASE = [0.2, 0.85, 0.2, 1] as const;

export function Scene2() {
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, x: '3%', scale: .97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, y: '-3%' }}
      transition={{ duration: .38, ease: EASE }}
      style={{ background: '#eae8df' }}
    >
      <div className="mono" style={{ position: 'absolute', left: '6%', top: '6.2%', fontSize: '2.8vmin', color: '#a45e49' }}>01 / PUBLIC VIEW</div>
      <motion.div
        initial={{ y: '3%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: .12, duration: .5, ease: EASE }}
        style={{ position: 'absolute', left: '9%', top: '12%', width: '82%', height: '77%' }}
      >
        <AppChrome style={{ height: '100%' }}>
          <AppMasthead />
          <div className="app-content" style={{ paddingTop: '1.25vmin' }}>
            <AppTabs active="progress" />
            <div style={{ display: 'grid', gridTemplateColumns: '1.08fr .92fr', gap: '4vmin', marginTop: '2.15vmin' }}>
              <div>
                <div className="app-eyebrow">PUBLIC PROGRESS</div>
                <div className="ui-title">Privacy Token Fund</div>
                <div className="ui-note">Fund-wide thesis for private money and confidential cross-chain settlement.</div>
                <div style={{ display: 'flex', gap: '1.4vmin', alignItems: 'baseline', marginTop: '2.6vmin' }}>
                  <span className="metric-label">HARD COMMITMENTS</span>
                  <span className="metric-number">$420,000</span>
                </div>
                <motion.div className="progress-track" style={{ marginTop: '1.3vmin', height: '.85vmin' }} initial={{ opacity: .35 }} animate={{ opacity: 1 }}>
                  <motion.div className="progress-fill" style={{ height: '100%' }} initial={{ scaleX: 0 }} animate={{ scaleX: .21 }} transition={{ delay: .55, duration: 1.1, ease: EASE }} />
                </motion.div>
                <div className="mono metric-label" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.8vmin' }}>
                  <span>$0</span><span>TARGET · $2,000,000</span>
                </div>
              </div>
              <div style={{ padding: '1.55vmin 1.8vmin', background: '#f1efe7', border: '1px solid #dfdbd0' }}>
                <div className="mono metric-label">AGGREGATE TOTALS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '1.7vmin' }}>
                  <div>
                    <div className="metric-label">SOFT INTEREST</div>
                    <div className="metric-number-small" style={{ marginTop: '.55vmin' }}>$86,500</div>
                  </div>
                  <div style={{ borderLeft: '1px solid #d9d5c9', paddingLeft: '1.5vmin' }}>
                    <div className="metric-label">HARD COMMITMENTS</div>
                    <div className="metric-number-small" style={{ marginTop: '.55vmin' }}>$420,000</div>
                  </div>
                </div>
                <div className="divider" style={{ margin: '1.7vmin 0 1.1vmin' }} />
                <AppFootnote>Individual commitment details are not shown here.</AppFootnote>
              </div>
            </div>
          </div>
        </AppChrome>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.7, duration: .4, ease: EASE }}
        className="note-tag mono"
        style={{ position: 'absolute', right: '7.2%', bottom: '8%', background: '#f0eee5', fontSize: '2.7vmin' }}
      >
        AGGREGATES ONLY
      </motion.div>
      <motion.div className="rule" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 4.55, duration: .35 }}
        style={{ left: '9%', bottom: '5.7%', width: '82%', height: '.2vmin' }} />
    </motion.section>
  );
}
