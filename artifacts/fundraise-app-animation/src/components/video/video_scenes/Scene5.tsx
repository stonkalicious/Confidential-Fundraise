import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';
import { AppChrome } from '../WalkthroughUI';

const EASE = [0.2, 0.85, 0.2, 1] as const;

export function Scene5() {
  const [walletStep, setWalletStep] = useState(0);
  useSceneTimer([
    { time: 520, callback: () => setWalletStep(1) },
    { time: 1260, callback: () => setWalletStep(2) },
    { time: 1980, callback: () => setWalletStep(3) },
  ]);
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, scale: 1.025 }}
      transition={{ duration: .38, ease: EASE }}
      style={{ background: '#deddd3' }}
    >
      <div className="mono" style={{ position: 'absolute', left: '6%', top: '5.8%', color: '#a45e49', fontSize: '2.8vmin' }}>A CLEAR BOUNDARY</div>
      <motion.div
        initial={{ x: '-2%', opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        transition={{ delay: .12, duration: .45, ease: EASE }}
        style={{ position: 'absolute', left: '6%', top: '13%', width: '45%', height: '76%' }}
      >
        <AppChrome style={{ height: '100%' }}>
          <div className="app-topbar" style={{ height: '6.4vmin' }}>
            <div className="brand-title">NEAR Intents <span style={{ fontWeight: 400, color: '#7b7669' }}>· Optional demo</span></div>
            <span className="app-flag">DRY-RUN QUOTE</span>
          </div>
          <div style={{ padding: '2.35vmin 3vmin' }}>
            <div className="mono metric-label" style={{ color: '#a45e49' }}>FIXED EXAMPLE</div>
            <div className="serif" style={{ fontSize: '5.6vmin', marginTop: '1.1vmin' }}>1 USDC</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2vmin', marginTop: '1.35vmin', color: '#676254' }}>
              <span className="note-tag mono" style={{ fontSize: '2.7vmin' }}>ETHEREUM</span>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: .55, duration: .6 }} style={{ height: 1, width: '7vmin', background: '#b86148', transformOrigin: 'left' }} />
              <span className="note-tag mono" style={{ fontSize: '2.7vmin' }}>ARBITRUM</span>
            </div>
            <div className="quote-wallet-flow" aria-label="NEAR wallet authentication flow">
              <div className="quote-wallet-heading">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7.5h14.5A1.5 1.5 0 0 1 20 9v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6.5A2.5 2.5 0 0 1 6.5 4H18" />
                  <path d="M15 12h5v3h-5a1.5 1.5 0 0 1 0-3Z" />
                  <circle cx="15.5" cy="13.5" r=".45" fill="currentColor" stroke="none" />
                </svg>
                <span>NEAR WALLET</span>
                <span className="quote-wallet-demo">AUTHENTICATION · DEMO</span>
              </div>
              <motion.div
                className="quote-wallet-progress"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: walletStep / 3 }}
                transition={{ duration: .38, ease: EASE }}
                style={{ transformOrigin: 'left' }}
              />
              {[
                'Connect NEAR wallet',
                'Approve authentication · empty intent',
                'Confidential quote returned',
              ].map((label, index) => (
                <motion.div
                  key={label}
                  className={`quote-wallet-step${walletStep === index + 1 ? ' is-active' : ''}${walletStep > index + 1 ? ' is-complete' : ''}`}
                  animate={{
                    opacity: walletStep >= index + 1 ? 1 : .56,
                    x: walletStep === index + 1 ? '.45vmin' : 0,
                    scale: walletStep === index + 1 ? 1.015 : 1,
                  }}
                  transition={{ duration: .32, ease: EASE }}
                >
                  <motion.span
                    className={`quote-wallet-marker${walletStep > index + 1 ? ' is-complete' : ''}${walletStep === index + 1 ? ' is-active' : ''}`}
                    animate={{
                      scale: walletStep === index + 1 ? 1.22 : 1,
                    }}
                    transition={{ duration: .22 }}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </motion.div>
              ))}
            </div>
            <motion.div
              className="quote-return-status"
              initial={{ opacity: 0, y: 7 }}
              animate={walletStep >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 7 }}
              transition={{ duration: .32, ease: EASE }}
            >
              <span className="status-stamp" style={{ borderColor: '#d2b8a8', color: '#864f40' }}>DRY-RUN QUOTE</span>
              <span className="mono quote-no-funds">NO FUNDS MOVE</span>
            </motion.div>
            <div className="ui-note" style={{ marginTop: '.6vmin', maxWidth: '48vmin' }}>A quote is not a payment or investment settlement.</div>
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
          style={{ marginTop: '2vmin', color: '#777468', fontSize: '2.7vmin' }}>
          DEMO ONLY · SYNTHETIC DATA
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.1, type: 'spring', stiffness: 220, damping: 18 }}
        style={{ position: 'absolute', bottom: '8.2%', right: '7%', display: 'flex', alignItems: 'center', gap: '1.1vmin', background: '#f8f6ef', padding: '.85vmin 1.25vmin', border: '1px solid #d7d2c5' }}
      >
        <img src={`${import.meta.env.BASE_URL}images/fundraising-logo.png`} alt="" style={{ width: '2.6vmin', height: '2.6vmin', borderRadius: '50%' }} />
        <span style={{ font: '600 2.7vmin var(--sans)' }}>Confidential Fundraising</span>
      </motion.div>
      <motion.div className="rule" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ delay: 4.65, duration: .72, ease: EASE }}
        style={{ left: '6%', bottom: '5.5%', width: '88%', height: '.22vmin' }} />
    </motion.section>
  );
}
