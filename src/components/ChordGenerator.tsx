'use client';

import { useState, useRef } from 'react';
import { Music, Play, Copy } from 'lucide-react';

const KEYS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const PROGRESSIONS: Record<string, { name: string; numerals: string; chords: number[] }[]> = {
  major: [
    { name: 'Pop', numerals: 'I - V - vi - IV', chords: [0, 7, 9, 5] },
    { name: 'Jazz', numerals: 'ii - V - I', chords: [2, 7, 0] },
    { name: 'Blues', numerals: 'I - IV - I - V', chords: [0, 5, 0, 7] },
    { name: 'Epic', numerals: 'vi - IV - I - V', chords: [9, 5, 0, 7] },
    { name: 'Emotional', numerals: 'I - vi - IV - V', chords: [0, 9, 5, 7] },
    { name: 'Dreamy', numerals: 'I - iii - vi - IV', chords: [0, 4, 9, 5] },
  ],
  minor: [
    { name: 'Dark', numerals: 'i - VI - III - VII', chords: [0, 8, 3, 10] },
    { name: 'Trap', numerals: 'i - iv - VI - V', chords: [0, 5, 8, 7] },
    { name: 'Cinematic', numerals: 'i - VII - VI - V', chords: [0, 10, 8, 7] },
    { name: 'R&B', numerals: 'i - iv - v - i', chords: [0, 5, 7, 0] },
    { name: 'Sad', numerals: 'i - v - VI - iv', chords: [0, 7, 8, 5] },
  ],
};

function noteToFreq(semitone: number, octave: number = 4): number {
  const midi = octave * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playChord(rootSemitone: number, isMinor: boolean, ctx: AudioContext) {
  const intervals = isMinor ? [0, 3, 7] : [0, 4, 7]; // minor or major triad
  intervals.forEach(interval => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = noteToFreq(rootSemitone + interval, 3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  });
}

export default function ChordGenerator() {
  const [selectedKey, setSelectedKey] = useState(0); // Index into KEYS
  const [mode, setMode] = useState<'major' | 'minor'>('major');
  const [activeChord, setActiveChord] = useState<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function handlePlayChord(semitone: number) {
    const ctx = getCtx();
    const root = (selectedKey + semitone) % 12;
    const isMinorChord = mode === 'minor' ? [0, 3, 5, 7].includes(semitone % 12) : [2, 4, 9].includes(semitone % 12);
    playChord(root, isMinorChord, ctx);
    setActiveChord(semitone);
    setTimeout(() => setActiveChord(null), 500);
  }

  function playProgression(chords: number[]) {
    const ctx = getCtx();
    chords.forEach((chord, i) => {
      setTimeout(() => {
        handlePlayChord(chord);
      }, i * 600);
    });
  }

  return (
    <div className="bg-[#0c0c14] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-teal-400 flex items-center gap-2">
          <Music className="w-4 h-4" /> CHORD GENERATOR
        </h3>
        <div className="flex gap-1">
          <select value={selectedKey} onChange={e => setSelectedKey(parseInt(e.target.value))}
            className="bg-white/5 text-[10px] text-white rounded px-2 py-1 border border-white/10">
            {KEYS.map((k, i) => <option key={k} value={i}>{k}</option>)}
          </select>
          <button onClick={() => setMode(mode === 'major' ? 'minor' : 'major')}
            className={`text-[10px] px-2 py-1 rounded ${mode === 'major' ? 'bg-teal-500/20 text-teal-400' : 'bg-purple-500/20 text-purple-400'}`}>
            {mode}
          </button>
        </div>
      </div>

      {/* Progressions */}
      <div className="space-y-2">
        {PROGRESSIONS[mode].map(prog => (
          <div key={prog.name}
            className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2 border border-white/5 hover:border-white/10 group">
            <div>
              <p className="text-[11px] text-white font-medium">{prog.name}</p>
              <p className="text-[9px] text-gray-500">{KEYS[selectedKey]} {mode}: {prog.numerals}</p>
            </div>
            <div className="flex gap-1 opacity-60 group-hover:opacity-100">
              <button onClick={() => playProgression(prog.chords)}
                className="w-6 h-6 rounded bg-teal-500/20 flex items-center justify-center text-teal-400 hover:bg-teal-500/30">
                <Play className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Chord pads */}
      <div className="mt-3 grid grid-cols-6 gap-1">
        {[0,2,4,5,7,9].map(semitone => {
          const noteName = KEYS[(selectedKey + semitone) % 12];
          const isMinorChord = mode === 'minor' ? [0,3,5,7].includes(semitone) : [2,4,9].includes(semitone);
          return (
            <button key={semitone}
              onClick={() => handlePlayChord(semitone)}
              className={`py-2 rounded text-center transition-all ${
                activeChord === semitone ? 'bg-teal-500/30 scale-95' : 'bg-white/[0.03] hover:bg-white/[0.06]'
              }`}>
              <span className="text-[10px] text-white font-medium">{noteName}</span>
              <span className="text-[7px] text-gray-600 block">{isMinorChord ? 'min' : 'maj'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
