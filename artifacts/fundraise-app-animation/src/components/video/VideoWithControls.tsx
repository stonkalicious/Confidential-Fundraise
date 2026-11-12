import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import { SCENE_DURATIONS } from './VideoTemplate';
import VideoTemplate from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS = [
  { title: 'Context: supplied posts + question', filePath: 'src/components/video/video_scenes/SceneContext.tsx' },
  { title: 'AgentRaised.com intro', filePath: 'src/components/video/video_scenes/SceneIntro.tsx' },
  { title: 'Founder prepares raise.md (proposed)', filePath: 'src/components/video/video_scenes/ScenePrep.tsx' },
  { title: 'Agent discovery (proposed)', filePath: 'src/components/video/video_scenes/SceneDiscover.tsx' },
  { title: 'Agent review + investor choice (proposed)', filePath: 'src/components/video/video_scenes/SceneReview.tsx' },
  { title: 'Soft commitment', filePath: 'src/components/video/video_scenes/Scene3.tsx' },
  { title: 'Founder review', filePath: 'src/components/video/video_scenes/Scene4.tsx' },
  { title: 'Privacy boundary', filePath: 'src/components/video/video_scenes/Scene5.tsx' },
];
const PROGRESS_TICK_MS = 60;

function formatPlaybackTime(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const {
    sceneKeys, activeIndex, locked, paused, muted, mountKey, tick, durations,
    activeDuration, activeStartTime, totalDuration, onSceneChange, jumpTo,
    toggleLock, togglePause, toggleMute,
  } = useSceneControls(SCENE_DURATIONS);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);

  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    const details = SCENE_DETAILS[index];
    if (!details?.filePath) return;
    window.parent.postMessage({
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: {
        sceneIndex: index,
        sceneCount: sceneKeys.length,
        sceneTitle: details.title,
        filePath: details.filePath,
        lineNumber: 1,
      },
    }, '*');
  }, [jumpTo, sceneKeys.length]);

  useEffect(() => {
    if (!paused) return;
    const frozen = document.getAnimations().filter((animation) => animation.playState === 'running');
    frozen.forEach((animation) => animation.pause());
    return () => frozen.forEach((animation) => animation.play());
  }, [paused]);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDocPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      if (sensorRef.current && !sensorRef.current.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [collapsed, tapPinned]);

  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
  }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      if (!current) { setHovering(false); setTapPinned(false); }
      return !current;
    });
  }, []);

  if (!isIframed) return <VideoTemplate />;
  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="video-control-wrap">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        paused={paused}
        muted={muted}
        onSceneChange={onSceneChange}
      />
      <div
        ref={sensorRef}
        className="video-control-sensor"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="video-control-spacer" aria-hidden="true" />
        <div className={`video-control-bar${barVisible ? ' is-visible' : ''}`} aria-hidden={!barVisible}>
          <button type="button" className="video-control-icon" onClick={togglePause} aria-label={paused ? 'Play' : 'Pause'} title={paused ? 'Play' : 'Pause'}>
            {paused ? <Play /> : <Pause />}
          </button>
          <button type="button" className={`video-control-icon${locked ? ' is-active' : ''}`} onClick={toggleLock} aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'} aria-pressed={locked} title="Loop current scene">
            <Repeat />
          </button>
          <button type="button" className="video-control-icon" onClick={toggleMute} aria-label={muted ? 'Unmute audio' : 'Mute audio'} aria-pressed={muted} title={muted ? 'Unmute audio' : 'Mute audio'}>
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <div className="video-control-divider" aria-hidden="true" />
          <PlaybackStatus
            sceneKeys={sceneKeys}
            activeIndex={activeIndex}
            activeDuration={activeDuration}
            activeStartTime={activeStartTime}
            totalDuration={totalDuration}
            tick={tick}
            paused={paused}
            onJumpTo={handleJumpTo}
          />
          <button type="button" className="video-control-icon" onClick={handleToggleCollapsed} aria-label={collapsed ? 'Show controls' : 'Hide controls'} aria-expanded={!collapsed} title={collapsed ? 'Show controls' : 'Hide controls'}>
            {collapsed ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaybackStatus({
  sceneKeys, activeIndex, activeDuration, activeStartTime, totalDuration, tick, paused, onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  paused: boolean;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed(elapsedBaseRef.current + performance.now() - start);
    }, PROGRESS_TICK_MS);
    return () => {
      window.clearInterval(id);
      elapsedBaseRef.current += performance.now() - start;
    };
  }, [tick, paused]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(totalDuration, activeStartTime + Math.min(elapsed, activeDuration));
  return (
    <>
      <div className="video-control-segments">
        {sceneKeys.map((key, index) => (
          <button
            key={key}
            type="button"
            className="video-control-segment"
            onClick={() => onJumpTo(index)}
            aria-label={`Jump to scene ${index + 1}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          >
            <span style={{ width: `${index === activeIndex ? progress * 100 : index < activeIndex ? 100 : 0}%` }} />
          </button>
        ))}
      </div>
      <div className="video-control-count">{activeIndex + 1}/{sceneKeys.length}</div>
      <div className="video-control-time" role="timer" aria-label={`Playback time ${formatPlaybackTime(totalElapsed)} of ${formatPlaybackTime(totalDuration)}`}>
        {formatPlaybackTime(totalElapsed)} / {formatPlaybackTime(totalDuration)}
      </div>
    </>
  );
}
