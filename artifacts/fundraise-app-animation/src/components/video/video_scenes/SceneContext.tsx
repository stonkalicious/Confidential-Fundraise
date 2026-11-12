import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import collison from '@assets/Screenshot_2026-11-12_at_09.12.42_1794474827076.png';
import qureshi from '@assets/Screenshot_2026-11-12_at_09.13.20_1794474827072.png';

const EASE = [0.2, 0.85, 0.2, 1] as const;

// Context only: two public posts shown as supplied screenshots, then the question.
export function SceneContext() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 4000, callback: () => setBeat(1) },
    { time: 8000, callback: () => setBeat(2) },
  ]);
  return (
    <motion.section className="film" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: '-3%' }} transition={{ duration: .34, ease: EASE }} style={{ background: '#e9e6dc' }}>
      <AnimatePresence>
        {beat < 2 && (
          <motion.div key={`h${beat}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: .4, ease: EASE }}
            style={{ position: 'absolute', left: '6%', right: '6%', top: '3.6%', textAlign: 'center', font: '400 5vmin/1.1 var(--display)', color: 'var(--dark)' }}>
            {beat === 0 ? 'Company formations are growing exponentially.' : 'Company.md files let investors agents filter quickly.'}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {beat === 0 && (
          <motion.img key="pc" src={collison} alt="Post by Patrick Collison (@patrickc)"
            initial={{ opacity: 0, y: '4%', scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: '-6%' }} transition={{ duration: .5, ease: EASE }}
            style={{ position: 'absolute', left: '29.5%', top: '14%', height: '80%', borderRadius: '1.2vmin', boxShadow: '0 2vmin 5vmin rgba(43,25,40,.28)' }} />
        )}
        {beat === 1 && (
          <motion.img key="hq" src={qureshi} alt="Post by Haseeb Qureshi (@hosseeb)"
            initial={{ opacity: 0, x: '6%' }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, y: '-4%' }} transition={{ duration: .5, ease: EASE }}
            style={{ position: 'absolute', left: '7%', top: '17%', width: '86%', borderRadius: '1.2vmin', boxShadow: '0 2vmin 5vmin rgba(43,25,40,.28)' }} />
        )}
        {beat === 2 && (
          <motion.div key="q" initial={{ opacity: 0, y: '4%' }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: .55, ease: EASE }}
            style={{ position: 'absolute', left: '8.5%', right: '8%', top: '30%' }}>
            <div style={{ font: '400 13vmin/1.02 var(--display, "Instrument Serif"), serif', color: 'var(--dark, #2b1928)' }}>
              What would a <span style={{ fontStyle: 'italic', color: '#a4402b' }}>Raise.md</span> file allow?
            </div>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: .7, duration: .7, ease: EASE }}
              style={{ marginTop: '4vmin', height: '.5vmin', width: '40%', background: '#a4402b', transformOrigin: 'left' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
