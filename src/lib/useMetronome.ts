import { useRef, useCallback } from 'react';

export function useMetronome() {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const beatRef = useRef(0);

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function tick(bpm: number, onBeat?: (beat: number) => void) {
    const ctx = getCtx();
    const beat = beatRef.current;
    const isDownbeat = beat % 4 === 0;

    // Click sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = isDownbeat ? 1000 : 800;
    gain.gain.setValueAtTime(isDownbeat ? 0.5 : 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);

    onBeat?.(beat);
    beatRef.current = (beat + 1) % 16;
  }

  const start = useCallback((bpm: number, onBeat?: (beat: number) => void) => {
    stop();
    beatRef.current = 0;
    const msPerBeat = (60 / bpm) * 1000;
    tick(bpm, onBeat);
    intervalRef.current = setInterval(() => tick(bpm, onBeat), msPerBeat);
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    beatRef.current = 0;
  }, []);

  return { start, stop };
}
