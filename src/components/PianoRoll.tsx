'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Trash2 } from 'lucide-react';

const NOTES = ['B','A#','A','G#','G','F#','F','E','D#','D','C#','C'];
const NOTE_COLORS: Record<string, boolean> = { 'C#': true, 'D#': true, 'F#': true, 'G#': true, 'A#': true };

function noteToFreq(noteName: string, octave: number): number {
  const noteIndex = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(noteName);
  const midi = (octave + 1) * 12 + noteIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface Note {
  row: number; // 0 = top (B4), 23 = bottom (C3)
  col: number; // 0-15 (beat)
  velocity: number;
}

export default function PianoRoll({ bpm = 120 }: { bpm?: number }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentCol, setCurrentCol] = useState(-1);
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const colRef = useRef(0);

  const rows = 24; // 2 octaves
  const cols = 16;

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function getNoteName(row: number): { name: string; octave: number } {
    const noteIdx = row % 12;
    const octave = 4 - Math.floor(row / 12);
    return { name: NOTES[noteIdx], octave };
  }

  function toggleNote(row: number, col: number) {
    setNotes(prev => {
      const existing = prev.findIndex(n => n.row === row && n.col === col);
      if (existing >= 0) {
        return prev.filter((_, i) => i !== existing);
      }
      return [...prev, { row, col, velocity: 100 }];
    });
  }

  function playNoteSound(row: number) {
    const ctx = getCtx();
    const { name, octave } = getNoteName(row);
    const freq = noteToFreq(name, octave);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3000;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  const tick = useCallback(() => {
    const col = colRef.current;
    setCurrentCol(col);

    // Play all notes at this column
    const colNotes = notes.filter(n => n.col === col);
    colNotes.forEach(n => playNoteSound(n.row));

    colRef.current = (col + 1) % cols;
  }, [notes]);

  function startStop() {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPlaying(false);
      setCurrentCol(-1);
      colRef.current = 0;
    } else {
      const msPerBeat = (60 / bpm / 4) * 1000;
      colRef.current = 0;
      tick();
      intervalRef.current = setInterval(tick, msPerBeat);
      setPlaying(true);
    }
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (playing && intervalRef.current) {
      clearInterval(intervalRef.current);
      const msPerBeat = (60 / bpm / 4) * 1000;
      intervalRef.current = setInterval(tick, msPerBeat);
    }
  }, [bpm, tick, playing]);

  return (
    <div className="bg-[#0c0c14] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-teal-400">PIANO ROLL</h3>
          <button onClick={startStop}
            className={`w-7 h-7 rounded flex items-center justify-center ${playing ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'}`}>
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
          </button>
          <span className="text-[9px] text-gray-500">{bpm} BPM</span>
        </div>
        <button onClick={() => setNotes([])}
          className="text-[9px] px-2 py-1 rounded bg-white/5 text-gray-500 hover:text-white flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Clear
        </button>
      </div>

      <div className="flex overflow-hidden rounded-lg border border-white/5">
        {/* Piano keys */}
        <div className="w-10 flex-shrink-0">
          {Array.from({ length: rows }, (_, row) => {
            const { name } = getNoteName(row);
            const isBlack = NOTE_COLORS[name];
            return (
              <div key={row}
                onClick={() => playNoteSound(row)}
                className={`h-5 flex items-center justify-end pr-1 border-b border-white/5 cursor-pointer ${
                  isBlack ? 'bg-gray-900 text-gray-600' : 'bg-white/[0.03] text-gray-500'
                } hover:bg-teal-500/10 text-[7px]`}>
                {name === 'C' ? `C${getNoteName(row).octave}` : ''}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ minWidth: cols * 24 }}>
            {Array.from({ length: rows }, (_, row) => {
              const { name } = getNoteName(row);
              const isBlack = NOTE_COLORS[name];
              return (
                <div key={row} className="flex h-5">
                  {Array.from({ length: cols }, (_, col) => {
                    const hasNote = notes.some(n => n.row === row && n.col === col);
                    const isCurrentCol = currentCol === col;
                    return (
                      <div key={col}
                        onClick={() => { toggleNote(row, col); if (!hasNote) playNoteSound(row); }}
                        className={`w-6 h-5 border-r border-b cursor-pointer transition-colors ${
                          col % 4 === 0 ? 'border-r-white/10' : 'border-r-white/[0.03]'
                        } border-b-white/[0.03] ${
                          hasNote
                            ? 'bg-teal-500/60 hover:bg-teal-500/80'
                            : isBlack
                              ? 'bg-white/[0.01] hover:bg-white/[0.04]'
                              : 'bg-white/[0.02] hover:bg-white/[0.05]'
                        } ${isCurrentCol ? 'ring-1 ring-inset ring-teal-400/30' : ''}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Beat markers */}
      <div className="flex ml-10 mt-1">
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className={`w-6 text-center text-[7px] ${currentCol === i ? 'text-teal-400' : 'text-gray-700'}`}>
            {i % 4 === 0 ? i / 4 + 1 : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
