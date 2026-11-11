import { motion } from 'framer-motion';
import { AppChrome } from '../WalkthroughUI';

const EASE = [0.2, 0.85, 0.2, 1] as const;

export function Scene5() {
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, scale: 1.025 }}
      transition={{ duration: .38, ease: EASE }}
      style={{ background: '#deddd3' }}
    >
      <div className="mono" style={{ position: 'absolute', left: '6%', top: '5.8%', color: '#a45e49', fontSize: '1.05vmin' }}>A CLEAR BOUNDARY</div>
      <motion.div
        initial={{ x: '-2%', opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        transition={{ delay: .12, duration: .45, ease: EASE }}
        style={{ position: 'absolute', left: '6%', top: '13%', width: '45%', height: '68%' }}
      >
        <AppChrome style={{ height: '100%' }}>
          <div className="app-topbar" style={{ height: '5vmin' }}>
            <div className="brand-title">NEAR Intents <span style={{ fontWeight: 400, color: '#7b7669' }}>· Optional demo</span></div>
            <span className="app-flag">DRY-RUN QUOTE</span>
          </div>
          <div style={{ padding: '3vmin 3vmin' }}>
            <div className="mono metric-label" style={{ color: '#a45e49' }}>FIXED EXAMPLE</div>
            <div className="serif" style={{ fontSize: '5.6vmin', marginTop: '1.1vmin' }}>1 USDC</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2vmin', marginTop: '1.35vmin', color: '#676254' }}>
              <span className="note-tag mono" style={{ fontSize: '.94vmin' }}>ETHEREUM</span>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: .55, duration: .6 }} style={{ height: 1, width: '7vmin', background: '#b86148', transformOrigin: 'left' }} />
              <span className="note-tag mono" style={{ fontSize: '.94vmin' }}>ARBITRUM</span>
            </div>
            <div className="status-stamp" style={{ marginTop: '2.1vmin', borderColor: '#d2b8a8', color: '#864f40' }}>DRY-RUN QUOTE</div>
            <div className="mono" style={{ marginTop: '1.75vmin', fontSize: '1.5vmin', color: '#a34e3d', letterSpacing: '.13em' }}>NO FUNDS MOVE</div>
            <div className="ui-note" style={{ marginTop: '.85vmin', maxWidth: '34vmin', fontSize: '1.08vmin' }}>A quote is not a payment or investment settlement.</div>
          </div>
        </AppChrome>
      </motion.div>
      <div style={{ position: 'absolute', top: '15%', bottom: '18%', left: '53%', width: '1px', background: '#c6c2b6' }} />
      <motion.div
        initial={{ x: '3%', opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        transition={{ delay: .2, duration: .55, ease: EASE }}
        style={{ position: 'absolute', left: '58%', top: '23%', width: '36%' }}
      >
        <div className="serif" style={{ fontSize: '7.1vmin', lineHeight: .89, letterSpacing: '-.04em' }}>
          Public totals.<br /><em>Private</em><br />records.
        </div>
        <motion.div className="mono" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .68, duration: .35 }}
          style={{ marginTop: '2vmin', color: '#777468', fontSize: '1.05vmin' }}>
          DEMO ONLY · SYNTHETIC DATA
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.1, type: 'spring', stiffness: 220, damping: 18 }}
        style={{ position: 'absolute', bottom: '8.2%', right: '7%', display: 'flex', alignItems: 'center', gap: '1.1vmin', background: '#f8f6ef', padding: '.85vmin 1.25vmin', border: '1px solid #d7d2c5' }}
      >
        <img src={`${import.meta.env.BASE_URL}images/fundraising-logo.png`} alt="" style={{ width: '2.6vmin', height: '2.6vmin', borderRadius: '50%' }} />
        <span style={{ font: '600 1.05vmin var(--sans)' }}>Confidential Fundraising</span>
      </motion.div>
      <motion.div className="rule" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ delay: 4.65, duration: .72, ease: EASE }}
        style={{ left: '6%', bottom: '5.5%', width: '88%', height: '.22vmin' }} />
    </motion.section>
  );
}
