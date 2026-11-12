import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { AgentHeader, ProposedBadge } from '../AgentUI';
import { AppChrome, AppMasthead } from '../WalkthroughUI';

const EASE = [0.2, 0.85, 0.2, 1] as const;
const PROMPT = 'Create a raise.md from our company materials. Include sources and flag missing information.';

export function ScenePrep() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 1800, callback: () => setBeat(1) },
    { time: 5400, callback: () => setBeat(2) },
    { time: 6800, callback: () => setBeat(3) },
  ]);
  return (
    <motion.section className="film" initial={{ opacity: 0, x: '4%' }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-4%' }} transition={{ duration: .34, ease: EASE }} style={{ background: '#eeebe1' }}>
      <div className="scene-kicker mono">03 / FOUNDER PREPARES</div>
      <div style={{ position: 'absolute', right: '6%', top: '5.4%' }}><ProposedBadge /></div>

      <motion.div className="agent-card" initial={{ y: '4%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: .1, duration: .45, ease: EASE }}
        style={{ position: 'absolute', left: '6%', top: '15%', width: '40%' }}>
        <AgentHeader who="FOUNDER → OWN AGENT" />
        <div className="agent-bubble">
          {PROMPT.split(' ').map((w, i) => (
            <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .3 + i * .08, duration: .12 }}>{w} </motion.span>
          ))}
        </div>
      </motion.div>

      {/* beat 1: the agent's raise.md artifact */}
      <motion.div className="raise-doc" initial={{ opacity: 0, y: '6%' }}
        animate={beat >= 2
          ? { opacity: .0, x: '-8%', scale: .9 }
          : { opacity: beat >= 1 ? 1 : 0, y: beat >= 1 ? 0 : '6%' }}
        transition={{ duration: .5, ease: EASE }}
        style={{ position: 'absolute', left: '51%', top: '15%', width: '43%', height: '70%', visibility: beat >= 2 ? 'hidden' : 'visible' }}>
        <div className="raise-doc-tab mono">raise.md</div>
        <div className="doc-h1"># Privacy Token Fund</div>
        <div className="doc-h2">## Thesis</div>
        <div className="doc-line">Private money and confidential cross-chain settlement.</div>
        <div className="doc-h2">## Sources</div>
        <div className="doc-line mono doc-src">[1] Public fund thesis</div>
        <div className="doc-line mono doc-src">[2] Public progress page</div>
        <div className="doc-h2">## Missing information</div>
        <div className="doc-flag">! How are hard commitments confirmed?</div>
      </motion.div>

      {/* beat 2+: founder reviews the public raise page itself before it goes public */}
      <motion.div initial={{ opacity: 0, x: '6%' }}
        animate={{ opacity: beat >= 2 ? 1 : 0, x: beat >= 2 ? 0 : '6%' }}
        transition={{ duration: .5, ease: EASE }}
        style={{ position: 'absolute', left: '51%', top: '15%', width: '43%', height: '70%', visibility: beat >= 2 ? 'visible' : 'hidden' }}>
        <AppChrome style={{ height: '100%' }}>
          <AppMasthead flag="FOUNDER REVIEW" />
          <div className="app-content">
            <div className="app-eyebrow">PUBLIC RAISE PAGE · FOUNDER REVIEW</div>
            <div className="ui-title">Privacy Token Fund</div>
            <div className="ui-note">Private money and confidential cross-chain settlement.</div>
            <div className="page-status-row">
              <span className={`page-status${beat >= 3 ? ' is-public' : ''}`}>{beat >= 3 ? 'Approved · public' : 'Pending approval · not public'}</span>
              <span className="approve-btn" style={{ transform: beat >= 3 ? 'scale(.96)' : 'none', opacity: beat >= 3 ? .55 : 1 }}>Approve public raise page</span>
            </div>
            <div className="ui-note" style={{ marginTop: '1.6vmin', fontSize: '2.2vmin' }}>New raises stay private until approved.</div>
          </div>
        </AppChrome>
      </motion.div>
      <motion.div className="rule" initial={{ scaleX: 0 }} animate={{ scaleX: beat >= 3 ? 1 : 0 }} transition={{ delay: .9, duration: .6 }}
        style={{ left: '6%', bottom: '6%', width: '88%', height: '.2vmin' }} />
    </motion.section>
  );
}
