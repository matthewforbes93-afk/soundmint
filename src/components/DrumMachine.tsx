'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Square } from 'lucide-react';

interface DrumPattern {
  kick: boolean[];
  snare: boolean[];
  hihat: boolean[];
  clap: boolean[];
}

const EMPTY_PATTERN: DrumPattern = {
  kick: Array(16).fill(false),
  snare: Array(16).fill(false),
  hihat: Array(16).fill(false),
  clap: Array(16).fill(false),
};

const DRUM_COLORS: Record<string, string> = {
  kick: 'bg-red-500',
  snare: 'bg-yellow-500',
  hihat: 'bg-cyan-500',
  clap: 'bg-purple-500',
};

// Synth drums using Web Audio
function playKick(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  gain.gain.setValueAtTime(1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

function playSnare(ctx: AudioContext) {
  // Noise burst
  const bufferSize = ctx.sampleRate * 0.2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass'; filter.frequency.value = 1000;
  noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(ctx.destination);
  noiseGain.gain.setValueAtTime(0.8, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  noise.start(ctx.currentTime);
  // Tone
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.connect(oscGain); oscGain.connect(ctx.destination);
  osc.frequency.value = 200;
  oscGain.gain.setValueAtTime(0.7, ctx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
}

function playHihat(ctx: AudioContext) {
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass'; filter.frequency.value = 7000;
  noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  noise.start(ctx.currentTime);
}

function playClap(ctx: AudioContext) {
  for (let i = 0; i < 3; i++) {
    const bufferSize = ctx.sampleRate * 0.02;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) data[j] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 2000;
    noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.5, ctx.currentTime + i * 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.01 + 0.1);
    noise.start(ctx.currentTime + i * 0.01);
  }
}

const DRUM_SOUNDS: Record<string, (ctx: AudioContext) => void> = {
  kick: playKick, snare: playSnare, hihat: playHihat, clap: playClap,
};

export default function DrumMachine({ bpm = 120 }: { bpm?: number }) {
  const [pattern, setPattern] = useState<DrumPattern>({ ...EMPTY_PATTERN, kick: [...EMPTY_PATTERN.kick], snare: [...EMPTY_PATTERN.snare], hihat: [...EMPTY_PATTERN.hihat], clap: [...EMPTY_PATTERN.clap] });
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [volumes, setVolumes] = useState({ kick: 100, snare: 100, hihat: 80, clap: 90 });
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stepRef = useRef(0);

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function toggleStep(drum: keyof DrumPattern, step: number) {
    setPattern(prev => {
      const newArr = [...prev[drum]];
      newArr[step] = !newArr[step];
      return { ...prev, [drum]: newArr };
    });
  }

  const tick = useCallback(() => {
    const step = stepRef.current;
    setCurrentStep(step);
    const ctx = getCtx();

    (Object.keys(DRUM_SOUNDS) as (keyof DrumPattern)[]).forEach(drum => {
      if (pattern[drum][step] && volumes[drum] > 0) {
        DRUM_SOUNDS[drum](ctx);
      }
    });

    stepRef.current = (step + 1) % 16;
  }, [pattern, volumes]);

  function startStop() {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPlaying(false);
      setCurrentStep(-1);
      stepRef.current = 0;
    } else {
      const msPerStep = (60 / bpm / 4) * 1000; // 16th notes
      stepRef.current = 0;
      tick();
      intervalRef.current = setInterval(tick, msPerStep);
      setPlaying(true);
    }
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Update interval when BPM or pattern changes
  useEffect(() => {
    if (playing && intervalRef.current) {
      clearInterval(intervalRef.current);
      const msPerStep = (60 / bpm / 4) * 1000;
      intervalRef.current = setInterval(tick, msPerStep);
    }
  }, [bpm, tick, playing]);

  function loadPreset(name: string) {
    const presets: Record<string, DrumPattern> = {
      'boom-bap': {
        kick:  [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0].map(Boolean),
        snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
        hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
        clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
      },
      'trap': {
        kick:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0].map(Boolean),
        snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
        hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1].map(Boolean),
        clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1].map(Boolean),
      },
      'four-floor': {
        kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean),
        snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
        hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0].map(Boolean),
        clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1].map(Boolean),
      },
    };
    if (presets[name]) setPattern(presets[name]);
  }

  return (
    <div className="bg-[#0c0c14] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-teal-400">DRUM MACHINE</h3>
          <button onClick={startStop}
            className={`w-7 h-7 rounded flex items-center justify-center ${playing ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'}`}>
            {playing ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
          </button>
          <span className="text-[9px] text-gray-500">{bpm} BPM</span>
        </div>
        <div className="flex gap-1">
          {['boom-bap', 'trap', 'four-floor'].map(p => (
            <button key={p} onClick={() => loadPreset(p)}
              className="text-[9px] px-2 py-1 rounded bg-white/5 text-gray-500 hover:text-white">
              {p}
            </button>
          ))}
          <button onClick={() => setPattern({ kick: Array(16).fill(false), snare: Array(16).fill(false), hihat: Array(16).fill(false), clap: Array(16).fill(false) })}
            className="text-[9px] px-2 py-1 rounded bg-white/5 text-gray-500 hover:text-white">
            clear
          </button>
        </div>
      </div>

      {/* Step grid */}
      <div className="space-y-1">
        {(Object.keys(DRUM_SOUNDS) as (keyof DrumPattern)[]).map(drum => (
          <div key={drum} className="flex items-center gap-1">
            <button onClick={() => DRUM_SOUNDS[drum](getCtx())}
              className="w-12 text-[9px] text-gray-400 hover:text-white text-left uppercase font-medium">
              {drum}
            </button>
            <input type="range" min={0} max={100} value={volumes[drum]}
              onChange={e => setVolumes(prev => ({ ...prev, [drum]: parseInt(e.target.value) }))}
              className="w-10 accent-teal-500" style={{ height: 2 }} />
            <div className="flex gap-[2px] flex-1">
              {pattern[drum].map((on, i) => (
                <button key={i} onClick={() => toggleStep(drum, i)}
                  className={`flex-1 h-6 rounded-sm transition-all ${
                    currentStep === i ? 'ring-1 ring-white/30' : ''
                  } ${on ? `${DRUM_COLORS[drum]} opacity-80` : 'bg-white/[0.04] hover:bg-white/[0.08]'} ${
                    i % 4 === 0 ? 'ml-1' : ''
                  }`} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Step indicators */}
      <div className="flex gap-[2px] mt-1 ml-[88px]">
        {Array(16).fill(0).map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full ${currentStep === i ? 'bg-teal-400' : 'bg-white/5'} ${i % 4 === 0 ? 'ml-1' : ''}`} />
        ))}
      </div>
    </div>
  );
}
