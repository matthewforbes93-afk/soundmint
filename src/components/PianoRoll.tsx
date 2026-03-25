'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Trash2 } from 'lucide-react';

const ALL_NOTES = ['B','A#','A','G#','G','F#','F','E','D#','D','C#','C'];
const BLACK_NOTES = new Set(['C#','D#','F#','G#','A#']);

function noteToFreq(noteName: string, octave: number): number {
  const idx = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(noteName);
  return 440 * Math.pow(2, ((octave + 1) * 12 + idx - 69) / 12);
}

interface MidiNote {
  id: string;
  row: number;
  col: number;
  length: number; // in grid cells
  velocity: number; // 0-127
}

export default function PianoRoll({ bpm = 120 }: { bpm?: number }) {
  const [notes, setNotes] = useState<MidiNote[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentCol, setCurrentCol] = useState(-1);
  const [snap, setSnap] = useState<number>(1); // 1 = 1/16, 2 = 1/8, 4 = 1/4
  const [tool, setTool] = useState<'draw' | 'select'>('draw');
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const colRef = useRef(0);
  const drawRef = useRef<{ row: number; startCol: number } | null>(null);

  const totalRows = 60; // 5 octaves
  const totalCols = 32;
  const cellW = 20;
  const cellH = 14;
  const keyWidth = 48;

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function getNoteName(row: number): { name: string; octave: number } {
    const noteIdx = row % 12;
    const octave = 6 - Math.floor(row / 12);
    return { name: ALL_NOTES[noteIdx], octave };
  }

  function playNoteSound(row: number, dur = 0.15) {
    const ctx = getCtx();
    const { name, octave } = getNoteName(row);
    const freq = noteToFreq(name, octave);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = 4000;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur + 0.05);
  }

  function handleCellMouseDown(row: number, col: number, e: React.MouseEvent) {
    if (e.button === 2) {
      // Right click = delete
      e.preventDefault();
      setNotes(prev => prev.filter(n => !(n.row === row && col >= n.col && col < n.col + n.length)));
      return;
    }

    // Check if clicking existing note
    const existing = notes.find(n => n.row === row && col >= n.col && col < n.col + n.length);
    if (existing) {
      setSelectedNote(existing.id);
      return;
    }

    // Start drawing new note
    const snappedCol = Math.floor(col / snap) * snap;
    drawRef.current = { row, startCol: snappedCol };
    playNoteSound(row);
  }

  function handleCellMouseUp(row: number, col: number) {
    if (!drawRef.current) return;
    const { row: drawRow, startCol } = drawRef.current;
    if (drawRow !== row) { drawRef.current = null; return; }

    const endCol = Math.max(startCol + snap, Math.ceil((col + 1) / snap) * snap);
    const length = endCol - startCol;

    const newNote: MidiNote = {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      row: drawRow,
      col: startCol,
      length,
      velocity: 100,
    };

    setNotes(prev => [...prev, newNote]);
    setSelectedNote(newNote.id);
    drawRef.current = null;
  }

  const tick = useCallback(() => {
    const col = colRef.current;
    setCurrentCol(col);
    const colNotes = notes.filter(n => col >= n.col && col < n.col + n.length && col === n.col);
    colNotes.forEach(n => {
      const durSecs = (n.length * (60 / bpm / 4));
      playNoteSound(n.row, durSecs);
    });
    colRef.current = (col + 1) % totalCols;
  }, [notes, bpm]);

  function startStop() {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPlaying(false);
      setCurrentCol(-1);
      colRef.current = 0;
    } else {
      const msPerStep = (60 / bpm / 4) * 1000;
      colRef.current = 0;
      tick();
      intervalRef.current = setInterval(tick, msPerStep);
      setPlaying(true);
    }
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  useEffect(() => {
    if (playing && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, (60 / bpm / 4) * 1000);
    }
  }, [bpm, tick, playing]);

  function updateVelocity(noteId: string, velocity: number) {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, velocity } : n));
  }

  return (
    <div className="bg-[#0c0c14] border border-white/5 rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-teal-400">PIANO ROLL</h3>
          <button onClick={startStop}
            className={`w-7 h-7 rounded flex items-center justify-center ${playing ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'}`}>
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
          </button>
          <span className="text-[9px] text-gray-500">{bpm} BPM</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[{ v: 1, l: '1/16' }, { v: 2, l: '1/8' }, { v: 4, l: '1/4' }].map(s => (
              <button key={s.v} onClick={() => setSnap(s.v)}
                className={`text-[8px] px-1.5 py-0.5 rounded ${snap === s.v ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-gray-600'}`}>
                {s.l}
              </button>
            ))}
          </div>
          <span className="text-[8px] text-gray-600">{notes.length} notes</span>
          <button onClick={() => { setNotes([]); setSelectedNote(null); }}
            className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-gray-500 hover:text-white flex items-center gap-1">
            <Trash2 className="w-2.5 h-2.5" /> Clear
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex overflow-hidden rounded border border-white/5" style={{ height: 200 }}>
        {/* Piano keys */}
        <div className="flex-shrink-0 overflow-y-auto" style={{ width: keyWidth }}>
          {Array.from({ length: totalRows }, (_, row) => {
            const { name, octave } = getNoteName(row);
            const isBlack = BLACK_NOTES.has(name);
            return (
              <div key={row} onClick={() => playNoteSound(row)}
                className={`flex items-center justify-end pr-1 border-b border-white/5 cursor-pointer ${
                  isBlack ? 'bg-gray-900 text-gray-600' : 'bg-white/[0.03] text-gray-500'
                } hover:bg-teal-500/10`}
                style={{ height: cellH }}>
                <span className="text-[7px]">{name === 'C' ? `C${octave}` : isBlack ? '' : name}</span>
              </div>
            );
          })}
        </div>

        {/* Note grid - scrollable */}
        <div className="flex-1 overflow-auto" onContextMenu={e => e.preventDefault()}>
          <div style={{ width: totalCols * cellW, position: 'relative' }}>
            {/* Grid background */}
            {Array.from({ length: totalRows }, (_, row) => {
              const { name } = getNoteName(row);
              const isBlack = BLACK_NOTES.has(name);
              return (
                <div key={row} className="flex" style={{ height: cellH }}>
                  {Array.from({ length: totalCols }, (_, col) => (
                    <div key={col}
                      onMouseDown={(e) => handleCellMouseDown(row, col, e)}
                      onMouseUp={() => handleCellMouseUp(row, col)}
                      className={`border-r border-b cursor-crosshair ${
                        col % 4 === 0 ? 'border-r-white/10' : 'border-r-white/[0.03]'
                      } border-b-white/[0.03] ${
                        isBlack ? 'bg-white/[0.01]' : 'bg-white/[0.025]'
                      } ${currentCol === col ? 'bg-teal-500/10' : ''}`}
                      style={{ width: cellW, height: cellH }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Notes overlay */}
            {notes.map(note => (
              <div key={note.id}
                onClick={() => setSelectedNote(note.id)}
                className={`absolute rounded-sm cursor-pointer ${
                  selectedNote === note.id ? 'ring-1 ring-white/50' : ''
                }`}
                style={{
                  left: note.col * cellW,
                  top: note.row * cellH,
                  width: note.length * cellW - 1,
                  height: cellH - 1,
                  background: `rgba(45, 212, 191, ${0.3 + (note.velocity / 127) * 0.5})`,
                  borderLeft: '2px solid rgba(45, 212, 191, 0.8)',
                }}
              />
            ))}

            {/* Playhead */}
            {currentCol >= 0 && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-teal-400 z-20 pointer-events-none"
                style={{ left: currentCol * cellW }} />
            )}
          </div>
        </div>
      </div>

      {/* Velocity editor */}
      {notes.length > 0 && (
        <div className="mt-2 h-10 flex items-end gap-px overflow-x-auto" style={{ paddingLeft: keyWidth }}>
          {Array.from({ length: totalCols }, (_, col) => {
            const colNotes = notes.filter(n => n.col === col);
            if (colNotes.length === 0) return <div key={col} style={{ width: cellW }} className="flex-shrink-0" />;
            const maxVel = Math.max(...colNotes.map(n => n.velocity));
            return (
              <div key={col} className="flex-shrink-0 flex items-end" style={{ width: cellW }}>
                <div className="w-full bg-teal-500/40 rounded-t-sm cursor-pointer"
                  style={{ height: `${(maxVel / 127) * 100}%` }}
                  onClick={() => {
                    const note = colNotes[0];
                    const newVel = note.velocity > 64 ? 40 : 100;
                    colNotes.forEach(n => updateVelocity(n.id, newVel));
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Beat markers */}
      <div className="flex mt-0.5" style={{ paddingLeft: keyWidth }}>
        {Array.from({ length: totalCols }, (_, i) => (
          <div key={i} className={`text-center text-[7px] ${currentCol === i ? 'text-teal-400' : 'text-gray-700'}`}
            style={{ width: cellW }}>
            {i % 4 === 0 ? `${i / 4 + 1}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
