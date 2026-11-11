import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { AppChrome, AppMasthead } from '../WalkthroughUI';

const EASE = [0.2, 0.85, 0.2, 1] as const;

export function Scene1() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 470, callback: () => setBeat(1) },
    { time: 870, callback: () => setBeat(2) },
    { time: 1450, callback: () => setBeat(3) },
    { time: 1950, callback: () => setBeat(4) },
    { time: 2380, callback: () => setBeat(5) },
  ]);
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, scale: 1.025 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: '-4%' }}
      transition={{ duration: 0.28, ease: EASE }}
      style={{ background: '#f0eee5' }}
    >
      <div className="mono" style={{ position: 'absolute', top: '8%', left: '6%', fontSize: '1.32vmin', color: '#a45e49' }}>
        CONFIDENTIAL FUNDRAISING <span style={{ color: '#8b867a' }}>/ DEMO</span>
      </div>
      <motion.div
        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: .4, ease: EASE }}
        style={{ position: 'absolute', left: '6%', top: '20%', width: '.25vmin', height: '53%', background: '#b86148', transformOrigin: 'top' }}
      />
      <div style={{ position: 'absolute', left: '8.5%', top: '22%', width: '34%', zIndex: 2 }}>
        <motion.div
          key={beat > 1 ? 'exposure' : beat > 0 ? 'without' : 'interest'}
          initial={{ opacity: 0, y: '30%', scale: .84 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 270, damping: 19 }}
          className="serif hero-line"
        >
          {beat > 1 ? <>LIST YOUR PROJECT<br />IN PUBLIC.</> : beat > 0 ? 'IN PUBLIC.' : 'LIST YOUR PROJECT'}
        </motion.div>
        {beat > 2 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .35, ease: EASE }}
            className="fine-copy" style={{ marginTop: '2.5vmin', color: '#6f6b60', maxWidth: '28vmin' }}
          >
            Fund it privately with Near.<br />Agent first fundraising.
          </motion.div>
        )}
        {beat > 3 && (
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: .35 }}
            className="mono" style={{ marginTop: '2vmin', fontSize: '1.08vmin', color: '#888273', transformOrigin: 'left' }}>
            DEMO DATA · NO INVESTMENT SETTLEMENT
          </motion.div>
        )}
      </div>
      <motion.div
        initial={{ x: '4%', opacity: 0, scale: .97 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        transition={{ delay: .22, duration: .65, ease: EASE }}
        style={{ position: 'absolute', left: '47%', top: '18%', width: '47%', height: '67%' }}
      >
        <AppChrome style={{ height: '100%' }}>
          <AppMasthead />
          <div style={{ padding: '3.1vmin 3.2vmin' }}>
            <div className="mono" style={{ fontSize: '1.08vmin', color: '#a45e49' }}>PUBLIC PROGRESS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: '1.4vmin' }}>
              <div className="serif" style={{ fontSize: '6.8vmin', lineHeight: .92 }}>$420,000</div>
              <div className="mono" style={{ fontSize: '1.1vmin', lineHeight: 1.8, textAlign: 'right', color: '#777468' }}>TARGET<br /><strong style={{ color: '#302b43' }}>$2,000,000</strong></div>
            </div>
            <div className="progress-track" style={{ marginTop: '2.6vmin', height: '.85vmin' }}>
              <motion.div className="progress-fill" initial={{ scaleX: 0 }} animate={{ scaleX: .21 }} transition={{ delay: .65, duration: .9, ease: EASE }} style={{ height: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1vmin' }} className="mono metric-label">
              <span>HARD COMMITMENTS</span><span>21%</span>
            </div>
            <div className="divider" style={{ margin: '2.5vmin 0 1.5vmin' }} />
            <div className="mono metric-label">INDIVIDUAL COMMITMENT DETAILS ARE NOT SHOWN HERE.</div>
          </div>
        </AppChrome>
      </motion.div>
      <motion.div
        className="rule" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
        transition={{ delay: 2.5, duration: .46, ease: EASE }}
        style={{ left: '8.5%', bottom: '10%', width: '84%', height: '.22vmin' }}
      />
    </motion.section>
  );
}
