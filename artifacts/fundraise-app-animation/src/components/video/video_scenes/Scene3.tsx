import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { AppChrome, AppMasthead, AppTabs } from '../WalkthroughUI';

const EASE = [0.2, 0.85, 0.2, 1] as const;

export function Scene3() {
  const [submitted, setSubmitted] = useState(false);
  const [fold, setFold] = useState(false);
  useSceneTimer([
    { time: 2450, callback: () => setSubmitted(true) },
    { time: 4070, callback: () => setFold(true) },
  ]);
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, scale: .98 }}
      transition={{ duration: .36, ease: EASE }}
      style={{ background: '#f0eee5' }}
    >
      <div className="mono" style={{ position: 'absolute', left: '6%', top: '7%', color: '#a45e49', fontSize: '2.8vmin' }}>02 / PROSPECT</div>
      <div className="mono" style={{ position: 'absolute', right: '6%', top: '18%', width: '17%', borderTop: '1px solid #cfcabd', paddingTop: '1.1vmin', fontSize: '2.7vmin', lineHeight: 1.2, color: '#777468' }}>
        NO WALLET<br />NO TRANSFER
      </div>
      <motion.div
        animate={fold ? { x: '19%', y: '-8%', scale: .8, opacity: .96 } : { x: 0, y: 0, scale: 1, opacity: 1 }}
        transition={{ duration: .48, ease: EASE }}
        style={{ position: 'absolute', left: '9%', top: '14%', width: '66%', height: '72%' }}
      >
        <AppChrome style={{ height: '100%' }}>
          <AppMasthead />
          <div className="app-content" style={{ paddingTop: '1.15vmin' }}>
            <AppTabs active="prospect" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr .65fr', gap: '3.3vmin', marginTop: '1.8vmin' }}>
              <div>
                <div className="app-eyebrow">PROSPECT</div>
                <div className="ui-title" style={{ fontSize: '2.8vmin', marginTop: '.45vmin' }}>Submit a soft commitment</div>
                <div style={{ marginTop: '1.6vmin' }}>
                  <label className="form-label">Identifier</label>
                  <div className="form-field">
                    <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} transition={{ delay: .45, duration: .8 }}>
                      demo-investor-001
                    </motion.span><i className="caret" />
                  </div>
                </div>
                <div style={{ marginTop: '1.2vmin' }}>
                  <label className="form-label">Amount</label>
                  <div className="form-field" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--mono)', color: '#898475', fontSize: '2.8vmin' }}>USD</span>
                    <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: .38 }}>$10,000</motion.span>
                  </div>
                </div>
                <motion.div
                  animate={submitted ? { scale: .98, backgroundColor: '#66806b' } : { scale: 1, backgroundColor: '#302b43' }}
                  transition={{ duration: .18 }}
                  className="button-art" style={{ marginTop: '1.35vmin' }}
                >
                  {submitted ? 'Soft commitment recorded' : 'Submit soft commitment'}
                </motion.div>
              </div>
              <div style={{ borderLeft: '1px solid #ded9cc', paddingLeft: '2.5vmin', paddingTop: '2.3vmin' }}>
                <div className="mono metric-label" style={{ color: '#a45e49' }}>THRESHOLD</div>
                <div className="serif" style={{ marginTop: '1.5vmin', fontSize: '3.8vmin' }}>$2,000,000</div>
                <div className="ui-note" style={{ marginTop: '1.6vmin', lineHeight: 1.55 }}>Aggregate hard commitments reach the threshold. This does not trigger settlement.</div>
              </div>
            </div>
          </div>
        </AppChrome>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 9 }} animate={submitted ? { opacity: 1, y: 0 } : { opacity: 0, y: 9 }}
        transition={{ duration: .28 }}
        style={{ position: 'absolute', left: '12%', bottom: '8.5%', display: 'flex', gap: '1vmin', alignItems: 'center' }}
      >
        <span className="tiny-dot" style={{ background: '#66806b' }} />
        <span className="mono" style={{ fontSize: '2.8vmin', color: '#586b58' }}>INTEREST ONLY · NO MONEY SENT · WALLET NOT REQUIRED</span>
      </motion.div>
      <motion.div className="rule" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 4.5, duration: .35 }}
        style={{ left: '9%', bottom: '5.5%', width: '66%', height: '.18vmin' }} />
    </motion.section>
  );
}
