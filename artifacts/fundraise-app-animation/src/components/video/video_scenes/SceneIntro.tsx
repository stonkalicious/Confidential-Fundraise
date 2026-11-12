import { motion } from 'framer-motion';

const EASE = [0.2, 0.85, 0.2, 1] as const;
const LINES = ['Scrap webforms, emails and cold calls.', 'Let founders and investors use their agents to find the best matches.'];

export function SceneIntro() {
  return (
    <motion.section className="film" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: '-4%' }} transition={{ duration: .34, ease: EASE }} style={{ background: '#eeebe1' }}>
      <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: .5, ease: EASE }}
        style={{ position: 'absolute', left: '6%', top: '22%', width: '.6vmin', height: '56%', background: '#a4402b', transformOrigin: 'top' }} />
      <div style={{ position: 'absolute', left: '10%', right: '7%', top: '22%' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .6, ease: EASE }}
          style={{ font: '400 13vmin/1 var(--display)', color: 'var(--dark)', letterSpacing: '-.01em' }}>
          AgentRaised<span style={{ color: '#a4402b', fontStyle: 'italic' }}>.com</span>
        </motion.div>
        {LINES.map((l, i) => (
          <motion.div key={l} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: .9 + i * .7, duration: .5, ease: EASE }}
            style={{ marginTop: i === 0 ? '5vmin' : '1.6vmin', font: '500 4.4vmin/1.3 var(--sans)', color: 'var(--dark)', maxWidth: '90%' }}>
            {l}
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
