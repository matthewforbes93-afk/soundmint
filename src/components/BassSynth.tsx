'use client';

import { useState, useRef } from 'react';

const BASS_PRESETS: Record<string, { freq: number; decay: number; distortion: number; pitch: number }> = {
  '808': { freq: 55, decay: 1.5, distortion: 0, pitch: 40 },
  'sub': { freq: 40, decay: 2.0, distortion: 0, pitch: 20 },
  'dirty': { freq: 55, decay: 1.0, distortion: 0.8, pitch: 60 },
  'boom': { freq: 80, decay: 0.8, distortion: 0.3, pitch: 80 },
  'trap': { freq: 50, decay: 1.8, distortion: 0.5, pitch: 50 },
};

export default function BassSynth() {
  const [preset, setPreset] = useState('808');
  const [freq, setFreq] = useState(55);
  const [decay, setDecay] = useState(1.5);
  const [distortion, setDistortion] = useState(0);
  const [pitchDrop, setPitchDrop] = useState(40);
  const ctxRef = useRef<AudioContext | null>(null);

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function applyPreset(name: string) {
    const p = BASS_PRESETS[name];
    if (!p) return;
    setPreset(name);
    setFreq(p.freq);
    setDecay(p.decay);
    setDistortion(p.distortion);
    setPitchDrop(p.pitch);
  }

  function playBass() {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    // Pitch drop (808 style)
    osc.frequency.setValueAtTime(freq + pitchDrop, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + 0.08);

    // Distortion
    if (distortion > 0) {
      const waveshaper = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = (Math.PI + distortion * 100) * x / (Math.PI + distortion * 100 * Math.abs(x));
      }
      waveshaper.curve = curve;
      osc.connect(waveshaper);
      waveshaper.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + decay + 0.1);
  }

  // Keyboard: play different notes
  function playNote(note: number) {
    const ctx = getCtx();
    const noteFreq = freq * Math.pow(2, note / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(noteFreq + pitchDrop, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(noteFreq, ctx.currentTime + 0.08);

    if (distortion > 0) {
      const ws = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = (Math.PI + distortion * 100) * x / (Math.PI + distortion * 100 * Math.abs(x));
      }
      ws.curve = curve;
      osc.connect(ws); ws.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + decay + 0.1);
  }

  const sliderClass = 'w-full accent-teal-500';

  return (
    <div className="bg-[#0c0c14] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-teal-400">808 / SUB BASS</h3>
        <div className="flex gap-1">
          {Object.keys(BASS_PRESETS).map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`text-[9px] px-2 py-1 rounded ${preset === p ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div>
          <span className="text-[8px] text-gray-500 block mb-1">FREQ</span>
          <input type="range" min={20} max={120} value={freq} onChange={e => setFreq(parseInt(e.target.value))} className={sliderClass} />
          <span className="text-[8px] text-gray-600">{freq}Hz</span>
        </div>
        <div>
          <span className="text-[8px] text-gray-500 block mb-1">DECAY</span>
          <input type="range" min={0.1} max={3} step={0.1} value={decay} onChange={e => setDecay(parseFloat(e.target.value))} className={sliderClass} />
          <span className="text-[8px] text-gray-600">{decay}s</span>
        </div>
        <div>
          <span className="text-[8px] text-gray-500 block mb-1">DIRT</span>
          <input type="range" min={0} max={1} step={0.05} value={distortion} onChange={e => setDistortion(parseFloat(e.target.value))} className={sliderClass} />
          <span className="text-[8px] text-gray-600">{Math.round(distortion * 100)}%</span>
        </div>
        <div>
          <span className="text-[8px] text-gray-500 block mb-1">PITCH</span>
          <input type="range" min={0} max={100} value={pitchDrop} onChange={e => setPitchDrop(parseInt(e.target.value))} className={sliderClass} />
          <span className="text-[8px] text-gray-600">{pitchDrop}Hz</span>
        </div>
      </div>

      {/* Bass keys */}
      <div className="flex gap-1">
        {[-12,-10,-8,-7,-5,-3,-1,0,2,4,5,7].map(note => (
          <button key={note} onClick={() => playNote(note)}
            onMouseDown={() => playNote(note)}
            className="flex-1 h-10 rounded bg-white/[0.03] hover:bg-teal-500/20 active:bg-teal-500/30 border border-white/5 text-[7px] text-gray-600 transition-colors">
            {['C','D','E','F','G','A','B','C','D','E','F','G'][note + 12] || ''}
          </button>
        ))}
      </div>
    </div>
  );
}
