import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { AgentHeader, ProposedBadge } from '../AgentUI';

const EASE = [0.2, 0.85, 0.2, 1] as const;
const RAISES = ['Privacy Token Fund', 'AI Encyclopedia', 'Private Social Trading', 'Universal Checkout Widget', 'Swarm-for-Hire'];
const MATCH = [0, 2, 4];
const LOG = ['Exploring public raises', 'Reading raise.md', 'Reading public raise pages'];
const DOC = [
  { title: 'Privacy Token Fund', excerpt: 'Fund-wide thesis for private money and confidential cross-chain settlement.' },
  { title: 'Private Social Trading', excerpt: 'An agent can receive a key and act on trades without the trader opening the whole book.' },
  { title: 'Swarm-for-Hire', excerpt: 'Others can fund an agent’s inference; accepted work is paid from the budget.' },
];

export function SceneDiscover() {
  const [beat, setBeat] = useState(0);
  const [line, setLine] = useState(-1);
  useSceneTimer([
    { time: 1900, callback: () => setBeat(1) },
    { time: 3300, callback: () => setBeat(2) },
    { time: 3800, callback: () => setLine(0) },
    { time: 4300, callback: () => setLine(1) },
    { time: 4800, callback: () => setLine(2) },
    { time: 5100, callback: () => setBeat(3) },
    { time: 5300, callback: () => setLine(3) },
  ]);
  return (
    <motion.section className="film" initial={{ opacity: 0, y: '3%' }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: '-4%' }} transition={{ duration: .34, ease: EASE }} style={{ background: '#e9e6dc' }}>
      <div className="scene-kicker mono">02A / INVESTOR ASKS · AGENT SEARCHES</div>
      <div style={{ position: 'absolute', right: '6%', top: '5.4%' }}><ProposedBadge /></div>

      <motion.div className="agent-card" initial={{ opacity: 0, x: '-3%' }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: .1, duration: .45, ease: EASE }}
        style={{ position: 'absolute', left: '6%', top: '15%', width: '41%' }}>
        <AgentHeader who="INVESTOR → OWN AGENT" />
        <motion.div className="agent-bubble" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .4, duration: .4 }}>
          I’m looking for NEAR projects using agents for private fundraising and investor discovery. Find matching public raises and review them critically.
        </motion.div>
        <div className="agent-log">
          {LOG.map((l, i) => (
            <motion.div key={l} className="agent-log-row mono" initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: beat >= i + 1 ? 1 : 0, x: beat >= i + 1 ? 0 : -6 }} transition={{ duration: .3 }}>
              <span className={`quote-wallet-marker ${beat > i + 1 ? 'is-complete' : 'is-active'}`} />{l}
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div animate={{ opacity: beat >= 2 ? 0 : 1, x: beat >= 2 ? '-4%' : 0 }} transition={{ duration: .4, ease: EASE }}
        style={{ position: 'absolute', left: '52%', top: '15%', width: '42%' }}>
        <div className="mono metric-label" style={{ marginBottom: '1.2vmin' }}>PUBLIC RAISES</div>
        {RAISES.map((r, i) => {
          const hit = MATCH.includes(i);
          return (
            <motion.div key={r} className={`scan-row${beat >= 1 && hit ? ' is-hit' : ''}${beat >= 1 && !hit ? ' is-dim' : ''}`}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 + i * .08, duration: .3 }}>
              <motion.i className="scan-sweep" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ delay: 1 + i * .16, duration: .35 }} />
              <span>{r}</span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* agent opens each match's raise.md and its cited public sources */}
      <motion.div className="raise-doc" initial={{ opacity: 0, x: '6%' }}
        animate={{ opacity: beat >= 2 ? 1 : 0, x: beat >= 2 ? 0 : '6%' }} transition={{ duration: .45, ease: EASE }}
        style={{ position: 'absolute', left: '52%', top: '15%', width: '42%', height: '70%' }}>
        <div className="raise-doc-tab mono">raise.md · selected public raises</div>
        {DOC.map((d, i) => (
          <div key={d.title} className={`read-block${line === i ? ' is-reading' : ''}${line > i ? ' is-read' : ''}`}>
            <div className="doc-h2" style={{ marginTop: 0 }}>{d.title}</div>
            <div className="read-excerpt">{d.excerpt}</div>
          </div>
        ))}
        <motion.div className="source-open mono" animate={{ opacity: beat >= 3 ? 1 : 0, y: beat >= 3 ? 0 : 8 }} transition={{ duration: .3 }}>
          Reading public raise pages
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
