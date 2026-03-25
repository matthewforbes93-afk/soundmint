'use client';

import { useState, useRef, useCallback } from 'react';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const PRESETS: Record<string, { osc: OscillatorType; attack: number; decay: number; sustain: number; release: number; filterFreq: number; filterQ: number }> = {
  pad: { osc: 'sine', attack: 0.5, decay: 0.3, sustain: 0.7, release: 1.0, filterFreq: 2000, filterQ: 1 },
  lead: { osc: 'sawtooth', attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.3, filterFreq: 5000, filterQ: 2 },
  bass: { osc: 'square', attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2, filterFreq: 800, filterQ: 3 },
  pluck: { osc: 'triangle', attack: 0.001, decay: 0.3, sustain: 0.0, release: 0.1, filterFreq: 3000, filterQ: 5 },
  strings: { osc: 'sawtooth', attack: 0.8, decay: 0.5, sustain: 0.9, release: 1.5, filterFreq: 4000, filterQ: 0.5 },
};

function noteToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export default function Synth() {
  const [preset, setPreset] = useState<string>('lead');
  const [oscType, setOscType] = useState<OscillatorType>('sawtooth');
  const [attack, setAttack] = useState(0.01);
  const [decay, setDecay] = useState(0.1);
  const [sustain, setSustain] = useState(0.8);
  const [release, setRelease] = useState(0.3);
  const [filterFreq, setFilterFreq] = useState(5000);
  const [filterQ, setFilterQ] = useState(2);
  const [octave, setOctave] = useState(4);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const ctxRef = useRef<AudioContext | null>(null);
  const activeOscRef = useRef<Map<number, { osc: OscillatorNode; gain: GainNode }>>(new Map());

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function applyPreset(name: string) {
    const p = PRESETS[name];
    if (!p) return;
    setPreset(name);
    setOscType(p.osc);
    setAttack(p.attack);
    setDecay(p.decay);
    setSustain(p.sustain);
    setRelease(p.release);
    setFilterFreq(p.filterFreq);
    setFilterQ(p.filterQ);
  }

  const playNote = useCallback((midiNote: number) => {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = oscType;
    osc.frequency.value = noteToFreq(midiNote);

    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    // ADSR
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + attack);
    gain.gain.linearRampToValueAtTime(sustain * 0.5, now + attack + decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);

    activeOscRef.current.set(midiNote, { osc, gain });
    setActiveNotes(prev => new Set(prev).add(midiNote));
  }, [oscType, attack, decay, sustain, filterFreq, filterQ]);

  const stopNote = useCallback((midiNote: number) => {
    const entry = activeOscRef.current.get(midiNote);
    if (entry) {
      const ctx = getCtx();
      const now = ctx.currentTime;
      entry.gain.gain.cancelScheduledValues(now);
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
      entry.gain.gain.linearRampToValueAtTime(0, now + release);
      entry.osc.stop(now + release + 0.1);
      activeOscRef.current.delete(midiNote);
    }
    setActiveNotes(prev => { const s = new Set(prev); s.delete(midiNote); return s; });
  }, [release]);

  // Build 2 octaves of keys
  const keys: { note: number; name: string; isBlack: boolean }[] = [];
  for (let o = 0; o < 2; o++) {
    for (let n = 0; n < 12; n++) {
      const midi = (octave + o) * 12 + n;
      keys.push({ note: midi, name: NOTE_NAMES[n], isBlack: [1,3,6,8,10].includes(n) });
    }
  }

  const knobClass = 'flex flex-col items-center gap-1';
  const sliderClass = 'w-full accent-teal-500';

  return (
    <div className="bg-[#0c0c14] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-teal-400">SYNTHESIZER</h3>
        <div className="flex gap-1">
          {Object.keys(PRESETS).map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`text-[9px] px-2 py-1 rounded font-medium ${preset === p ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        <div className={knobClass}>
          <span className="text-[8px] text-gray-500">OSC</span>
          <select value={oscType} onChange={e => setOscType(e.target.value as OscillatorType)}
            className="bg-white/5 text-[9px] text-white rounded px-1 py-0.5 border border-white/10">
            {(['sine','square','sawtooth','triangle'] as const).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className={knobClass}>
          <span className="text-[8px] text-gray-500">ATK</span>
          <input type="range" min={0.001} max={2} step={0.01} value={attack} onChange={e => setAttack(parseFloat(e.target.value))} className={sliderClass} />
          <span className="text-[8px] text-gray-600">{attack.toFixed(2)}s</span>
        </div>
        <div className={knobClass}>
          <span className="text-[8px] text-gray-500">DEC</span>
          <input type="range" min={0.01} max={2} step={0.01} value={decay} onChange={e => setDecay(parseFloat(e.target.value))} className={sliderClass} />
          <span className="text-[8px] text-gray-600">{decay.toFixed(2)}s</span>
        </div>
        <div className={knobClass}>
          <span className="text-[8px] text-gray-500">SUS</span>
          <input type="range" min={0} max={1} step={0.01} value={sustain} onChange={e => setSustain(parseFloat(e.target.value))} className={sliderClass} />
          <span className="text-[8px] text-gray-600">{(sustain*100).toFixed(0)}%</span>
        </div>
        <div className={knobClass}>
          <span className="text-[8px] text-gray-500">REL</span>
          <input type="range" min={0.01} max={3} step={0.01} value={release} onChange={e => setRelease(parseFloat(e.target.value))} className={sliderClass} />
          <span className="text-[8px] text-gray-600">{release.toFixed(2)}s</span>
        </div>
        <div className={knobClass}>
          <span className="text-[8px] text-gray-500">FILTER</span>
          <input type="range" min={100} max={10000} step={100} value={filterFreq} onChange={e => setFilterFreq(parseInt(e.target.value))} className={sliderClass} />
          <span className="text-[8px] text-gray-600">{filterFreq}Hz</span>
        </div>
      </div>

      {/* Octave selector */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setOctave(Math.max(1, octave - 1))} className="text-[10px] text-gray-500 hover:text-white px-2 py-0.5 bg-white/5 rounded">-</button>
        <span className="text-[10px] text-gray-400">Octave {octave}</span>
        <button onClick={() => setOctave(Math.min(7, octave + 1))} className="text-[10px] text-gray-500 hover:text-white px-2 py-0.5 bg-white/5 rounded">+</button>
      </div>

      {/* Piano keyboard */}
      <div className="relative h-20 flex">
        {keys.filter(k => !k.isBlack).map(k => (
          <button key={k.note}
            onMouseDown={() => playNote(k.note)}
            onMouseUp={() => stopNote(k.note)}
            onMouseLeave={() => stopNote(k.note)}
            className={`flex-1 border border-gray-700 rounded-b-md flex items-end justify-center pb-1 transition-colors ${
              activeNotes.has(k.note) ? 'bg-teal-500/30' : 'bg-white/[0.03] hover:bg-white/[0.06]'
            }`}>
            <span className="text-[7px] text-gray-600">{k.name}</span>
          </button>
        ))}
        {/* Black keys overlay */}
        <div className="absolute top-0 left-0 right-0 h-12 flex pointer-events-none">
          {keys.map((k, i) => {
            if (!k.isBlack) return null;
            const whiteIndex = keys.slice(0, i).filter(x => !x.isBlack).length;
            const totalWhites = keys.filter(x => !x.isBlack).length;
            const leftPct = ((whiteIndex - 0.3) / totalWhites) * 100;
            return (
              <button key={k.note}
                onMouseDown={() => playNote(k.note)}
                onMouseUp={() => stopNote(k.note)}
                onMouseLeave={() => stopNote(k.note)}
                style={{ left: `${leftPct}%`, width: `${0.6 / totalWhites * 100}%` }}
                className={`absolute h-full rounded-b pointer-events-auto z-10 ${
                  activeNotes.has(k.note) ? 'bg-teal-600' : 'bg-gray-900 hover:bg-gray-800'
                } border border-gray-700`}>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
