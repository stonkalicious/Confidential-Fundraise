export const SPONSOR_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'pointermove',
  'keydown',
  'scroll',
  'touchstart',
];

export function startSponsorIdleLock(
  onIdle: () => void,
  timeoutMs = SPONSOR_IDLE_TIMEOUT_MS,
): () => void {
  let timer: number | null = null;
  let locked = false;

  const lock = () => {
    if (locked) return;
    locked = true;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    onIdle();
  };
  const resetTimer = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    if (document.visibilityState === 'hidden') {
      lock();
      return;
    }
    locked = false;
    timer = window.setTimeout(lock, timeoutMs);
  };

  ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, resetTimer));
  document.addEventListener('visibilitychange', resetTimer);
  resetTimer();

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    document.removeEventListener('visibilitychange', resetTimer);
  };
}
