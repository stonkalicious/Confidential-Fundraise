import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { AgentHeader, ProposedBadge } from '../AgentUI';

const EASE = [0.2, 0.85, 0.2, 1] as const;
const COLS = ['Evidence', 'Risks', 'Open questions'];
const REVIEW = [
  'The public thesis describes confidential cross-chain settlement. [1]',
  'Hard status alone is not proof of payment. [2]',
  'What evidence confirms funding?',
];
const LIST = ['Privacy Token Fund', 'Private Social Trading', 'Swarm-for-Hire'];

export function SceneReview() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 900, callback: () => setBeat(1) },
    { time: 2000, callback: () => setBeat(2) },
    { time: 3100, callback: () => setBeat(3) },
    { time: 4400, callback: () => setBeat(4) },
    { time: 6900, callback: () => setBeat(5) },
  ]);
  return (
    <motion.section className="film" initial={{ opacity: 0, x: '4%' }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-4%' }} transition={{ duration: .34, ease: EASE }} style={{ background: '#eeebe1' }}>
      <div className="scene-kicker mono">05 / AGENT REVIEWS · INVESTOR DECIDES</div>
      <div style={{ position: 'absolute', right: '6%', top: '5.4%' }}><ProposedBadge /></div>

      <div style={{ position: 'absolute', left: '6%', top: '15%', width: '27%' }}>
        <div className="mono metric-label">SHORTLIST</div>
        {LIST.map((r, i) => (
          <motion.div key={r} className={`short-row${i === 0 ? ' is-open' : ''}${beat >= 5 && i === 0 ? ' is-chosen' : ''}`}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .1 + i * .12, duration: .3 }}>
            <span className="mono">{String(i + 1).padStart(2, '0')}</span>{r}
          </motion.div>
        ))}
      </div>

      <motion.div className="review-card" initial={{ opacity: 0, y: '3%' }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: .2, duration: .45, ease: EASE }}
        style={{ position: 'absolute', left: '37%', top: '15%', width: '57%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2vmin' }}>
          <div className="review-title" style={{ flex: 1 }}>Privacy Token Fund</div>
          <div style={{ width: '38%' }}><AgentHeader who="AGENT REVIEWING" /></div>
        </div>
        <div className="review-cols">
          {COLS.map((h, i) => (
            <div key={h} className="review-col">
              <div className="review-h">{h}</div>
              <motion.div className="review-text" initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: beat >= i + 1 ? 1 : 0, x: beat >= i + 1 ? 0 : 14 }}
                transition={{ duration: .35, ease: EASE }}>
                {REVIEW[i]}
              </motion.div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div className="decision-bar" initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: beat >= 4 ? 1 : 0, y: beat >= 4 ? 0 : 10 }} transition={{ duration: .4, ease: EASE }}
        style={{ position: 'absolute', left: '37%', bottom: '11%', width: '57%' }}>
        <span className="mono">INVESTOR DECIDES</span>
        <span style={{ flex: 1, font: '600 2.8vmin/1.2 var(--sans)' }}>The agent commits nothing.</span>
        <span className="approve-btn" style={{ transform: beat >= 5 ? 'scale(.96)' : 'none' }}>
          {beat >= 5 ? 'Proceeding with Privacy Token Fund' : 'Proceed?'}
        </span>
      </motion.div>
      <motion.div className="rule" initial={{ scaleX: 0 }} animate={{ scaleX: beat >= 5 ? 1 : 0 }} transition={{ delay: .9, duration: .55 }}
        style={{ left: '6%', bottom: '5.7%', width: '88%', height: '.2vmin' }} />
    </motion.section>
  );
}
