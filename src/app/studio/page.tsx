'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Square, SkipBack, CircleDot, Repeat, Undo2, Redo2,
  Plus, Trash2, Wand2, Mic, Piano, Headphones, Settings2,
  Volume2, ChevronDown, ChevronUp, Save, Download, Upload,
  Activity, Music, Layers, Sliders as SlidersIcon, Drum, Keyboard
} from 'lucide-react';
import Synth from '@/components/Synth';
import DrumMachine from '@/components/DrumMachine';
import PianoRoll from '@/components/PianoRoll';
import ArrangementMarkers from '@/components/ArrangementMarkers';
import ChordGenerator from '@/components/ChordGenerator';
import BassSynth from '@/components/BassSynth';
import ExportDialog from '@/components/ExportDialog';
import Tabs from '@/components/ui/Tabs';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';
import { getAudioEngine, disposeAudioEngine } from '@/lib/audio-engine';
import { useSoundMintStore } from '@/lib/store';
import type { ProjectTrack } from '@/lib/project';

// ─── Constants ───
const COLORS = ['#34d399','#2dd4bf','#a78bfa','#22d3ee','#4ade80','#818cf8','#67e8f9','#6ee7b7','#c084fc','#5eead4'];

function wave(n: number = 300): number[] {
  let seed = n * 7 + 13;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed & 0x7fffffff) / 2147483647; };
  const w: number[] = [];
  for (let i = 0; i < n; i++) {
    const base = Math.sin(i * 0.05) * 0.3 + 0.5;
    w.push(base + (rand() - 0.5) * 0.4);
  }
  return w;
}

// ─── Level Meter Component ───
function Meter({ value, peak = false, size = 'md' }: { value: number; peak?: boolean; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-1' : 'h-1.5';
  const count = size === 'sm' ? 16 : 20;
  return (
    <div className="flex flex-col-reverse gap-[1px]">
      {Array.from({ length: count }, (_, i) => {
        const pct = i / count;
        const on = pct < value;
        let color = 'bg-teal-500';
        if (pct > 0.85) color = 'bg-red-500';
        else if (pct > 0.7) color = 'bg-yellow-500';
        return <div key={i} className={`w-1.5 ${h} rounded-[1px] transition-opacity duration-75 ${on ? color : 'bg-white/5'}`} />;
      })}
    </div>
  );
}

// ─── Knob Component ───
function Knob({ value, onChange, label, color = 'purple', min = 0, max = 100 }: {
  value: number; onChange: (v: number) => void; label: string; color?: string; min?: number; max?: number;
}) {
  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;
  const colors: Record<string, string> = { purple: '#a78bfa', blue: '#22d3ee', green: '#34d399', yellow: '#fbbf24', pink: '#f472b6', cyan: '#2dd4bf', mint: '#34d399', teal: '#2dd4bf' };
  const c = colors[color] || colors.purple;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-8 h-8 cursor-pointer"
        onMouseDown={(e) => {
          const startY = e.clientY;
          const startVal = value;
          const onMove = (ev: MouseEvent) => {
            const delta = (startY - ev.clientY) * ((max - min) / 100);
            onChange(Math.max(min, Math.min(max, Math.round(startVal + delta))));
          };
          const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}>
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <circle cx="16" cy="16" r="13" fill="#1a1a2e" stroke="#2a2a3e" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="13" fill="none" stroke={c} strokeWidth="2" strokeDasharray={`${pct * 55} 100`}
            strokeLinecap="round" transform="rotate(-135 16 16)" opacity="0.6" />
          <line x1="16" y1="16" x2="16" y2="5" stroke={c} strokeWidth="2" strokeLinecap="round"
            transform={`rotate(${angle} 16 16)`} />
        </svg>
      </div>
      <span className="text-[8px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ─── Channel Strip Component ───
function ChannelStrip({ track, meters, onUpdate, selected, onSelect }: {
  track: ProjectTrack & { armed?: boolean; waveform?: number[] }; meters: [number, number];
  onUpdate: (u: Partial<ProjectTrack>) => void; selected: boolean; onSelect: () => void;
}) {
  return (
    <div onClick={onSelect}
      className={`w-[72px] flex-shrink-0 flex flex-col items-center rounded-xl border transition-all cursor-pointer ${
        selected ? 'bg-white/[0.04] border-purple-500/30 shadow-lg shadow-purple-500/5' : 'bg-white/[0.02] border-white/5 hover:border-white/10'
      }`}>
      <div className="w-full px-2 pt-2 pb-1">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: track.color }} />
          <span className="text-[9px] text-gray-300 font-medium truncate">{track.name}</span>
        </div>
        <span className="text-[8px] text-gray-600">{track.type.toUpperCase()}</span>
      </div>

      <Knob value={track.pan} onChange={(v) => onUpdate({ pan: v })} label="Pan" min={-100} max={100} color="cyan" />

      <div className="flex items-end gap-1 px-1 py-2 flex-1">
        <Meter value={meters[0]} />
        <div className="flex flex-col items-center">
          <input type="range" min={0} max={100} value={track.volume}
            onChange={(e) => onUpdate({ volume: parseInt(e.target.value) })}
            className="appearance-none cursor-pointer w-1.5 rounded-full"
            style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 90,
              background: `linear-gradient(to top, ${track.color}44, ${track.color}11)` }} />
          <span className="text-[9px] text-gray-500 mt-1 font-mono">{track.volume}</span>
        </div>
        <Meter value={meters[1]} />
      </div>

      <div className="flex gap-0.5 pb-2">
        <button onClick={(e) => { e.stopPropagation(); onUpdate({ mute: !track.mute }); }}
          className={`text-[8px] w-5 h-5 rounded font-bold flex items-center justify-center ${track.mute ? 'bg-red-500/40 text-red-300' : 'bg-white/5 text-gray-600 hover:text-gray-300'}`}>M</button>
        <button onClick={(e) => { e.stopPropagation(); onUpdate({ solo: !track.solo }); }}
          className={`text-[8px] w-5 h-5 rounded font-bold flex items-center justify-center ${track.solo ? 'bg-yellow-500/40 text-yellow-300' : 'bg-white/5 text-gray-600 hover:text-gray-300'}`}>S</button>
      </div>
    </div>
  );
}

// ─── Extended track type (UI-only fields beyond ProjectTrack) ───
interface StudioTrack extends ProjectTrack {
  armed: boolean;
  waveform: number[];
  showAutomation: boolean;
  automationParam: 'volume' | 'pan' | 'reverb';
  automationPoints: { bar: number; value: number }[];
}

function projectToStudio(t: ProjectTrack, index: number): StudioTrack {
  return {
    ...t,
    color: t.color || COLORS[index % COLORS.length],
    armed: false,
    waveform: t.audioUrl ? wave() : [],
    showAutomation: false,
    automationParam: 'volume',
    automationPoints: [],
  };
}

// ═══ MAIN STUDIO PAGE ═══
export default function StudioPage() {
  const store = useSoundMintStore();
  const engine = useRef(getAudioEngine());

  // Local UI state
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [key, setKey] = useState('C');
  const [timeSig, setTimeSig] = useState('4/4');
  const [looping, setLooping] = useState(false);
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState('mixer');
  const [zoom, setZoom] = useState(1);
  const [meters, setMeters] = useState<Record<string, [number, number]>>({});
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [sections, setSections] = useState<{ id: string; name: string; startBar: number; color: string }[]>([]);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);

  const animRef = useRef(0);
  const startRef = useRef(0);
  const metronomeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Sync tracks to store ───
  const syncToStore = useCallback((updated: StudioTrack[]) => {
    // Push project tracks to the store (strip UI-only fields)
    updated.forEach(t => {
      const existing = store.project?.tracks.find(pt => pt.id === t.id);
      if (existing) {
        store.updateTrack(t.id, {
          name: t.name, volume: t.volume, pan: t.pan,
          mute: t.mute, solo: t.solo, audioUrl: t.audioUrl,
          effects: t.effects,
        });
      }
    });
  }, [store]);

  // ─── Track update helper ───
  function upd(id: string, u: Partial<StudioTrack>) {
    setTracks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...u } : t);
      // Push engine params in real-time
      const eng = engine.current;
      if (u.volume !== undefined) eng.setTrackParam(id, 'volume', u.volume);
      if (u.pan !== undefined) eng.setTrackParam(id, 'pan', u.pan);
      if (u.mute !== undefined) eng.setTrackParam(id, 'mute', u.mute);
      if (u.effects) {
        const fx = u.effects;
        eng.setTrackParam(id, 'eqLow', fx.eqLow);
        eng.setTrackParam(id, 'eqMid', fx.eqMid);
        eng.setTrackParam(id, 'eqHigh', fx.eqHigh);
        eng.setTrackParam(id, 'compThreshold', fx.compThreshold);
        eng.setTrackParam(id, 'compRatio', fx.compRatio);
        eng.setTrackParam(id, 'reverbSend', fx.reverbSend);
      }
      // Undo + store sync
      store.pushUndo();
      syncToStore(next);
      return next;
    });
  }

  function addTrack(type: ProjectTrack['type']) {
    const n = tracks.length;
    const names: Record<string, string> = { audio: `Audio ${n+1}`, midi: `MIDI ${n+1}`, instrument: `AI ${n+1}` };
    const pt = store.addTrack(names[type] || `Track ${n+1}`, type);
    const st = projectToStudio(pt, n);
    engine.current.createTrack(st.id, {
      volume: st.volume, pan: st.pan, mute: st.mute, solo: st.solo,
      eqLow: st.effects.eqLow, eqMid: st.effects.eqMid, eqHigh: st.effects.eqHigh,
      compThreshold: st.effects.compThreshold, compRatio: st.effects.compRatio,
      reverbSend: st.effects.reverbSend,
    });
    setTracks(prev => [...prev, st]);
  }

  // ─── Metronome (via engine click) ───
  const startMetronome = useCallback((bpmVal: number) => {
    stopMetronome();
    const eng = engine.current;
    eng.playClick(true);
    metronomeIntervalRef.current = setInterval(() => eng.playClick(), (60 / bpmVal) * 1000);
  }, []);

  const stopMetronome = useCallback(() => {
    if (metronomeIntervalRef.current) { clearInterval(metronomeIntervalRef.current); metronomeIntervalRef.current = null; }
  }, []);

  // ─── Keyboard shortcuts ───
  useKeyboardShortcuts({
    ' ': () => { setPlaying(p => !p); setRecording(false); },
    'r': () => { if (recording) stopStudioRecording(); else startStudioRecording(); },
    'm': () => setMetronomeOn(m => !m),
    'cmd+z': () => store.undo(),
    'cmd+shift+z': () => store.redo(),
  });

  // ─── Metronome effect ───
  useEffect(() => {
    if (playing && metronomeOn) startMetronome(bpm);
    else stopMetronome();
    return () => stopMetronome();
  }, [playing, metronomeOn, bpm, startMetronome, stopMetronome]);

  // ─── Recording ───
  async function startStudioRecording() {
    let armedTrack = tracks.find(t => t.armed);
    if (!armedTrack) {
      const targetId = selected || tracks[0]?.id;
      if (!targetId) return;
      armedTrack = tracks.find(t => t.id === targetId);
      if (!armedTrack) return;
      armedTrack = { ...armedTrack, armed: true };
      setTracks(prev => prev.map(t => ({ ...t, armed: t.id === targetId })));
    }

    const eng = engine.current;

    // Count-in: 4 clicks
    setMetronomeOn(true);
    let countIn = 4;
    const countInterval = setInterval(() => {
      eng.playClick(countIn === 4);
      countIn--;
      if (countIn <= 0) {
        clearInterval(countInterval);
        doRecord(armedTrack!);
      }
    }, (60 / bpm) * 1000);
  }

  async function doRecord(armedTrack: StudioTrack) {
    const eng = engine.current;
    const ok = await eng.startRecording();
    if (!ok) { setRecording(false); return; }

    setRecordingTrackId(armedTrack.id);
    setRecording(true);
    setPlaying(true);
  }

  async function stopStudioRecording() {
    const eng = engine.current;
    const audioBuf = await eng.stopRecording();
    if (audioBuf && recordingTrackId) {
      // Encode to WAV and upload
      const wavBuf = eng.encodeWav(audioBuf);
      const wavBlob = new Blob([wavBuf], { type: 'audio/wav' });
      const file = new File([wavBlob], `studio-rec-${Date.now()}.wav`, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', tracks.find(t => t.id === recordingTrackId)?.name || 'Recording');
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok && data.audio_url) {
          await eng.loadAudio(recordingTrackId, data.audio_url);
          upd(recordingTrackId, { audioUrl: data.audio_url, waveform: wave(), armed: false });
        }
      } catch (err) { console.error('Upload failed:', err); }
    }
    setRecordingTrackId(null);
    setRecording(false);
    setPlaying(false);
    setPos(0);
  }

  // ─── Load tracks on mount ───
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    const eng = engine.current;

    // If store has a project, load from there
    if (store.project && store.project.tracks.length > 0) {
      const studioTracks = store.project.tracks.map((t, i) => projectToStudio(t, i));
      studioTracks.forEach(t => {
        eng.createTrack(t.id, {
          volume: t.volume, pan: t.pan, mute: t.mute, solo: t.solo,
          eqLow: t.effects.eqLow, eqMid: t.effects.eqMid, eqHigh: t.effects.eqHigh,
          compThreshold: t.effects.compThreshold, compRatio: t.effects.compRatio,
          reverbSend: t.effects.reverbSend,
        });
        if (t.audioUrl) eng.loadAudio(t.id, t.audioUrl);
      });
      setBpm(store.project.bpm);
      setKey(store.project.key);
      setTimeSig(store.project.timeSignature);
      setTracks(studioTracks);
      return;
    }

    // Otherwise create a new project and fetch tracks from API
    if (!store.project) store.newProject('Untitled', 'Artist');

    fetch('/api/tracks').then(r => r.json()).then((apiTracks: Array<{id: string; title: string; audio_url: string | null; genre: string}>) => {
      const playable = (apiTracks || []).filter(t => t.audio_url);
      const studioTracks: StudioTrack[] = [];

      playable.slice(0, 4).forEach((t, i) => {
        const pt: ProjectTrack = {
          id: t.id, name: t.title, type: 'audio', color: COLORS[i % COLORS.length],
          audioUrl: t.audio_url, volume: 80, pan: 0, mute: false, solo: false,
          effects: { eqLow: 0, eqMid: 0, eqHigh: 0, compThreshold: -24, compRatio: 4, reverbSend: 0, delaySend: 0 },
        };
        store.updateProject({ tracks: [...(store.project?.tracks || []), pt] });
        const st = projectToStudio(pt, i);
        eng.createTrack(st.id, { volume: st.volume, pan: st.pan, mute: st.mute, solo: st.solo });
        if (st.audioUrl) eng.loadAudio(st.id, st.audioUrl);
        studioTracks.push(st);
      });

      if (studioTracks.length < 2) {
        const pt = store.addTrack('Audio 1', 'audio');
        const st = projectToStudio(pt, studioTracks.length);
        eng.createTrack(st.id);
        studioTracks.push(st);
      }
      const pt = store.addTrack('Record Here', 'audio');
      const st = projectToStudio(pt, studioTracks.length);
      eng.createTrack(st.id);
      studioTracks.push(st);

      setTracks(studioTracks);
    }).catch(() => {
      const t1 = store.addTrack('Audio 1', 'audio');
      const t2 = store.addTrack('Record Here', 'audio');
      const st1 = projectToStudio(t1, 0);
      const st2 = projectToStudio(t2, 1);
      eng.createTrack(st1.id);
      eng.createTrack(st2.id);
      setTracks([st1, st2]);
    });
  }, [initialized, store]);

  // ─── Cleanup ───
  useEffect(() => () => { disposeAudioEngine(); }, []);

  // ─── Play/Stop via engine + animate playhead + real meters ───
  useEffect(() => {
    const eng = engine.current;
    if (playing) {
      // Load + play all tracks that have audio
      const playPromises = tracks.map(async (track) => {
        if (!track.audioUrl || track.mute) return;
        if (track.audioUrl.endsWith('.webm')) return;
        // Ensure audio is loaded
        if (!eng.getTrack(track.id)?.buffer) {
          await eng.loadAudio(track.id, track.audioUrl);
        }
        eng.playTrack(track.id, pos);
      });

      // Animate playhead + real meters from engine analysers
      startRef.current = performance.now() - pos * 1000;
      const tick = () => {
        const t = (performance.now() - startRef.current) / 1000;
        setPos(t);
        const m: Record<string, [number, number]> = {};
        tracks.forEach(tr => {
          m[tr.id] = eng.getTrackLevel(tr.id);
        });
        setMeters(m);
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(animRef.current);
      eng.stopAll();
      const m: Record<string, [number, number]> = {};
      tracks.forEach(tr => { m[tr.id] = [0, 0]; });
      setMeters(m);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [playing]);

  // ─── Derived values ───
  const bar = Math.floor(pos * bpm / 60 / 4) + 1;
  const beat = Math.floor(pos * bpm / 60) % 4 + 1;
  const mins = Math.floor(pos / 60);
  const secs = (pos % 60).toFixed(1);
  const totalBars = 32;
  const pxPerBar = 80 * zoom;
  const playPx = (pos * bpm / 60 / 4) * pxPerBar;

  const [masterL, masterR] = playing ? engine.current.getMasterLevel() : [0, 0];

  const BOTTOM_TABS = [
    { id: 'mixer', label: 'Mixer', icon: <SlidersIcon className="w-3 h-3" /> },
    { id: 'fx', label: 'Effects', icon: <Activity className="w-3 h-3" /> },
    { id: 'synth', label: 'Synth', icon: <Keyboard className="w-3 h-3" /> },
    { id: 'drums', label: 'Drums', icon: <Drum className="w-3 h-3" /> },
    { id: 'piano', label: 'Piano Roll', icon: <Piano className="w-3 h-3" /> },
    { id: 'chords', label: 'Chords', icon: <Music className="w-3 h-3" /> },
    { id: 'bass', label: '808 Bass', icon: <Volume2 className="w-3 h-3" /> },
    { id: 'browser', label: 'Sounds', icon: <Music className="w-3 h-3" /> },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden select-none" style={{ background: 'linear-gradient(180deg, #0c0c14 0%, #080810 100%)' }}>

      {/* ═══ TRANSPORT BAR ═══ */}
      <div className="h-12 flex items-center px-3 gap-3 border-b border-white/5 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, #13131f, #0e0e18)' }}>

        {/* Transport buttons */}
        <div className="flex items-center gap-1">
          <button onClick={() => { setPlaying(false); setPos(0); }} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/5"><SkipBack className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setPlaying(!playing); setRecording(false); }}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${playing ? 'bg-gradient-to-b from-white to-gray-200 text-black shadow-lg shadow-white/10' : 'bg-white/10 text-white hover:bg-white/15'}`}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button onClick={() => { setPlaying(false); setRecording(false); setPos(0); }} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/5"><Square className="w-3 h-3" /></button>
          <button onClick={() => { if (recording) stopStudioRecording(); else startStudioRecording(); }}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${recording ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 animate-pulse' : 'bg-white/5 text-red-400/60 hover:text-red-400 hover:bg-white/10'}`}
            title="Record (R) — arm a track first">
            <CircleDot className="w-4 h-4" />
          </button>
          <button onClick={() => setLooping(!looping)}
            className={`w-7 h-7 flex items-center justify-center rounded-md ${looping ? 'text-teal-400 bg-teal-500/10' : 'text-gray-600 hover:text-gray-300'}`}>
            <Repeat className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMetronomeOn(!metronomeOn)} title="Metronome (M)"
            className={`w-7 h-7 flex items-center justify-center rounded-md text-[9px] font-bold ${metronomeOn ? 'text-teal-400 bg-teal-500/10' : 'text-gray-600 hover:text-gray-300'}`}>
            CLK
          </button>
        </div>

        {/* Display */}
        <div className="flex items-center gap-0.5 bg-black/40 rounded-lg px-3 py-1 border border-white/5 font-mono">
          <div className="pr-3 border-r border-white/5">
            <p className="text-[8px] text-gray-600">BAR</p>
            <p className="text-lg text-teal-400 font-bold leading-none">{bar}<span className="text-teal-400/40">.{beat}</span></p>
          </div>
          <div className="pl-3">
            <p className="text-[8px] text-gray-600">TIME</p>
            <p className="text-lg text-teal-400 font-bold leading-none">{mins}:{secs.padStart(4, '0')}</p>
          </div>
        </div>

        {/* BPM / Key / Sig */}
        <div className="flex items-center gap-1.5">
          <div className="bg-white/[0.03] rounded-lg px-2.5 py-1 border border-white/5">
            <p className="text-[7px] text-gray-600 uppercase">Tempo</p>
            <input type="number" value={bpm} onChange={(e) => { const v = parseInt(e.target.value) || 120; setBpm(v); engine.current.setBpm(v); }}
              className="w-10 bg-transparent text-sm font-mono text-white font-bold focus:outline-none" />
          </div>
          <div className="bg-white/[0.03] rounded-lg px-2.5 py-1 border border-white/5">
            <p className="text-[7px] text-gray-600 uppercase">Key</p>
            <select value={key} onChange={(e) => setKey(e.target.value)}
              className="bg-transparent text-sm font-mono text-white font-bold focus:outline-none cursor-pointer appearance-none">
              {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(k => <option key={k} value={k} className="bg-gray-900">{k}</option>)}
            </select>
          </div>
          <div className="bg-white/[0.03] rounded-lg px-2.5 py-1 border border-white/5">
            <p className="text-[7px] text-gray-600 uppercase">Sig</p>
            <select value={timeSig} onChange={(e) => setTimeSig(e.target.value)}
              className="bg-transparent text-sm font-mono text-white font-bold focus:outline-none cursor-pointer appearance-none">
              {['4/4','3/4','6/8'].map(t => <option key={t} value={t} className="bg-gray-900">{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-600">Zoom</span>
          <input type="range" min={0.3} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-16 accent-purple-500" />
          <button onClick={() => store.undo()} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/5" title="Undo (Cmd+Z)"><Undo2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => store.redo()} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/5" title="Redo (Cmd+Shift+Z)"><Redo2 className="w-3.5 h-3.5" /></button>
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/5" title="Save"><Save className="w-3.5 h-3.5" /></button>
          <button onClick={() => setShowExport(true)} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/5" title="Export Song"><Download className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* ═══ TIMELINE + TRACKS ═══ */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Arrangement sections */}
          <ArrangementMarkers sections={sections} totalBars={totalBars} pxPerBar={pxPerBar} onChange={setSections} />
          {/* Ruler */}
          <div className="h-6 border-b border-white/5 flex flex-shrink-0 bg-white/[0.01]">
            <div className="w-52 flex-shrink-0 border-r border-white/5" />
            <div className="flex-1 overflow-hidden relative">
              <div className="flex h-full" style={{ width: totalBars * pxPerBar }}>
                {Array.from({ length: totalBars }, (_, i) => (
                  <div key={i} className="border-l border-white/5 flex items-end px-1" style={{ width: pxPerBar }}>
                    <span className="text-[9px] text-gray-700 mb-0.5">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tracks */}
          <div className="flex-1 overflow-auto">
            {tracks.map((track) => (
              <React.Fragment key={track.id}>
              <div
                onClick={() => setSelected(track.id)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (!file || !file.type.startsWith('audio/')) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('title', file.name.replace(/\.[^.]+$/, ''));
                  try {
                    const res = await fetch('/api/upload', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (res.ok && data.audio_url) {
                      await engine.current.loadAudio(track.id, data.audio_url);
                      upd(track.id, { audioUrl: data.audio_url, name: file.name.replace(/\.[^.]+$/, ''), waveform: wave() });
                    }
                  } catch { /* ignore */ }
                }}
                className={`flex h-[72px] border-b border-white/[0.03] group cursor-pointer transition-colors ${
                  recordingTrackId === track.id ? 'bg-red-500/[0.06] ring-1 ring-inset ring-red-500/20' :
                  selected === track.id ? 'bg-white/[0.025]' : 'hover:bg-white/[0.015]'
                }`}>

                {/* Track header */}
                <div className="w-52 flex-shrink-0 border-r border-white/5 px-2 py-1.5 flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-10 rounded-full" style={{ background: track.color }} />
                    <div>
                      <input type="text" value={track.name} onChange={(e) => upd(track.id, { name: e.target.value })}
                        className="text-[11px] font-semibold text-white bg-transparent w-28 focus:outline-none focus:bg-white/5 rounded px-0.5" />
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[8px] px-1 py-px rounded bg-white/5 text-gray-500">{track.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); upd(track.id, { mute: !track.mute }); }}
                      className={`text-[8px] w-5 h-4 rounded font-bold flex items-center justify-center ${track.mute ? 'bg-red-500/30 text-red-400' : 'bg-white/5 text-gray-600'}`}>M</button>
                    <button onClick={(e) => { e.stopPropagation(); upd(track.id, { solo: !track.solo }); }}
                      className={`text-[8px] w-5 h-4 rounded font-bold flex items-center justify-center ${track.solo ? 'bg-yellow-500/30 text-yellow-400' : 'bg-white/5 text-gray-600'}`}>S</button>
                    <button onClick={(e) => { e.stopPropagation(); upd(track.id, { armed: !track.armed }); }}
                      className={`text-[8px] w-5 h-4 rounded font-bold flex items-center justify-center transition-all ${track.armed ? 'bg-red-600 text-white animate-pulse ring-1 ring-red-400/50' : 'bg-white/5 text-gray-600 hover:text-red-400'}`}
                      title={track.armed ? 'Disarm track' : 'Arm for recording'}>R</button>
                    <input type="range" min={0} max={100} value={track.volume}
                      onChange={(e) => upd(track.id, { volume: parseInt(e.target.value) })}
                      className="w-16 accent-purple-500 ml-auto" style={{ height: 3 }} />
                    <button onClick={(e) => { e.stopPropagation(); engine.current.removeTrack(track.id); store.removeTrack(track.id); setTracks(p => p.filter(t => t.id !== track.id)); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 ml-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>

                {/* Waveform */}
                <div className="flex-1 relative overflow-hidden">
                  {track.waveform.length > 0 && (
                    <div className="absolute inset-y-1 left-1 right-1">
                      <div className={`h-full rounded-md overflow-hidden ${track.mute ? 'opacity-20' : ''}`}
                        style={{ background: `${track.color}08`, border: `1px solid ${track.color}20`, width: `${60 * zoom}%` }}>
                        <svg viewBox={`0 0 ${track.waveform.length} 100`} preserveAspectRatio="none" className="w-full h-full">
                          {track.waveform.map((v, i) => (
                            <rect key={i} x={i} y={50 - v * 40} width={0.7} height={v * 80}
                              fill={track.color} opacity={0.5} />
                          ))}
                        </svg>
                      </div>
                    </div>
                  )}
                  {track.waveform.length === 0 && recordingTrackId === track.id && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-[10px] text-red-400 font-medium animate-pulse">RECORDING...</span>
                    </div>
                  )}
                  {track.waveform.length === 0 && recordingTrackId !== track.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[9px] text-gray-800">{track.armed ? 'Armed — hit Record' : 'Drop audio or record'}</span>
                    </div>
                  )}
                  {/* Playhead */}
                  <div className="absolute top-0 bottom-0 w-px bg-teal-400 z-10 pointer-events-none" style={{ left: playPx }} />
                </div>

                {/* Automation toggle */}
                <button onClick={(e) => { e.stopPropagation(); upd(track.id, { showAutomation: !track.showAutomation }); }}
                  className="absolute bottom-0.5 left-[210px] text-[7px] text-gray-700 hover:text-teal-400 z-20">
                  {track.showAutomation ? '▼ Auto' : '▶ Auto'}
                </button>
              </div>
            </React.Fragment>
          ))}

            {/* Add track */}
            <div className="h-10 flex items-center border-b border-white/[0.03]">
              <div className="w-52 flex-shrink-0 border-r border-white/5 px-3 flex gap-1.5">
                {[
                  { type: 'audio' as const, icon: Mic, label: 'Audio', color: 'text-green-500' },
                  { type: 'midi' as const, icon: Piano, label: 'MIDI', color: 'text-blue-500' },
                  { type: 'instrument' as const, icon: Wand2, label: 'AI', color: 'text-pink-500' },
                ].map(({ type, icon: Icon, label, color }) => (
                  <button key={type} onClick={() => addTrack(type)}
                    className={`flex items-center gap-1 text-[9px] ${color} opacity-40 hover:opacity-100 px-2 py-1 rounded hover:bg-white/5 transition-all`}>
                    <Icon className="w-3 h-3" /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM: MIXER / FX / BROWSER ═══ */}
      <div className="flex-shrink-0 border-t border-white/5" style={{ background: 'linear-gradient(180deg, #0e0e18, #0a0a12)' }}>
        {/* Tabs */}
        <div className="h-7 flex items-center px-2 border-b border-white/[0.03]">
          <Tabs tabs={BOTTOM_TABS} active={bottomTab} onChange={setBottomTab} />
        </div>

        {/* MIXER */}
        {bottomTab === 'mixer' && (
          <div className="h-56 flex p-2 gap-1.5 overflow-x-auto">
            {tracks.map((track) => (
              <ChannelStrip key={track.id} track={track} meters={meters[track.id] || [0, 0]}
                onUpdate={(u) => upd(track.id, u)} selected={selected === track.id} onSelect={() => setSelected(track.id)} />
            ))}

            {/* MASTER channel */}
            <div className="w-24 flex-shrink-0 flex flex-col items-center rounded-xl bg-gradient-to-b from-teal-500/5 to-transparent border border-teal-500/10">
              <div className="pt-2 pb-1">
                <span className="text-[9px] text-teal-400 font-bold tracking-wider">MASTER</span>
              </div>
              <Knob value={80} onChange={(v) => engine.current.setMasterVolume(v)} label="Vol" color="mint" />
              <div className="flex items-end gap-2 flex-1 pb-2">
                <div className="flex flex-col-reverse gap-[1px]">
                  {Array.from({ length: 24 }, (_, i) => {
                    const pct = i / 24;
                    const on = pct < masterL;
                    let color = 'bg-teal-500';
                    if (pct > 0.85) color = 'bg-red-500';
                    else if (pct > 0.7) color = 'bg-yellow-500';
                    return <div key={i} className={`w-2 h-1 rounded-[1px] transition-opacity duration-75 ${on ? color : 'bg-white/5'}`} />;
                  })}
                </div>
                <div className="flex flex-col-reverse gap-[1px]">
                  {Array.from({ length: 24 }, (_, i) => {
                    const pct = i / 24;
                    const on = pct < masterR;
                    let color = 'bg-teal-500';
                    if (pct > 0.85) color = 'bg-red-500';
                    else if (pct > 0.7) color = 'bg-yellow-500';
                    return <div key={i} className={`w-2 h-1 rounded-[1px] transition-opacity duration-75 ${on ? color : 'bg-white/5'}`} />;
                  })}
                </div>
              </div>
              <span className="text-[9px] text-gray-500 font-mono pb-2">0 dB</span>
            </div>
          </div>
        )}

        {/* EFFECTS */}
        {bottomTab === 'fx' && (
          <div className="h-56 p-3 overflow-auto">
            {selected ? (() => {
              const t = tracks.find(tr => tr.id === selected);
              if (!t) return null;
              return (
                <div className="flex gap-3">
                  {/* EQ */}
                  <div className="flex-1 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-teal-400 font-bold mb-3">PARAMETRIC EQ</p>
                    <div className="flex gap-4 items-end justify-center h-24">
                      {(['LOW', 'MID', 'HIGH'] as const).map((band, i) => {
                        const keys = ['eqLow', 'eqMid', 'eqHigh'] as const;
                        const val = t.effects[keys[i]];
                        return (
                          <div key={band} className="flex flex-col items-center">
                            <Knob value={val} onChange={(v) => {
                              const fx = { ...t.effects, [keys[i]]: v };
                              upd(t.id, { effects: fx });
                            }} label={band} min={-12} max={12} color="purple" />
                            <span className="text-[8px] text-gray-600 mt-1">{val > 0 ? '+' : ''}{val}dB</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Dynamics */}
                  <div className="flex-1 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-blue-400 font-bold mb-3">COMPRESSOR</p>
                    <div className="flex gap-4 items-end justify-center h-24">
                      <Knob value={Math.round((t.effects.compThreshold + 40) * (100 / 40))} onChange={(v) => {
                        const threshold = (v / 100) * 40 - 40;
                        upd(t.id, { effects: { ...t.effects, compThreshold: threshold } });
                      }} label="Amount" color="blue" />
                    </div>
                  </div>
                  {/* Reverb */}
                  <div className="flex-1 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-teal-400 font-bold mb-3">REVERB</p>
                    <div className="flex gap-4 items-end justify-center h-24">
                      <Knob value={t.effects.reverbSend} onChange={(v) => upd(t.id, { effects: { ...t.effects, reverbSend: v } })} label="Size" color="green" />
                    </div>
                  </div>
                  {/* Delay */}
                  <div className="flex-1 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-yellow-400 font-bold mb-3">DELAY</p>
                    <div className="flex gap-4 items-end justify-center h-24">
                      <Knob value={t.effects.delaySend} onChange={(v) => upd(t.id, { effects: { ...t.effects, delaySend: v } })} label="Time" color="yellow" />
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="h-full flex items-center justify-center text-gray-700 text-sm">Select a track to edit effects</div>
            )}
          </div>
        )}

        {/* BROWSER / Sounds */}
        {bottomTab === 'browser' && (
          <div className="h-56 p-3 overflow-auto">
            <div className="grid grid-cols-6 gap-1.5">
              {['Kick 808', 'Snare Crack', 'Hi-Hat Closed', 'Hi-Hat Open', 'Clap', 'Rim Shot',
                'Bass Sub', 'Bass Pluck', 'Piano Chord', 'Guitar Clean', 'Guitar Dist', 'Strings Pad',
                'Synth Lead', 'Synth Pad', 'Vocal Chop', 'Ad-Lib', 'FX Riser', 'FX Impact',
                'Brass Stab', 'Flute Melody', 'Bell Chime', 'Percussion', 'Shaker', 'Vinyl Noise',
              ].map(sample => (
                <button key={sample}
                  onClick={() => engine.current.playTone(200 + Math.random() * 600, 'sine', 0.3, 0.3)}
                  className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.03] hover:border-white/10 rounded-lg p-2 text-left transition-all group cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <Play className="w-2.5 h-2.5 text-gray-700 group-hover:text-teal-400 transition-colors" />
                    <span className="text-[10px] text-gray-500 group-hover:text-white transition-colors">{sample}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SYNTH */}
        {bottomTab === 'synth' && (
          <div className="h-56 overflow-auto p-2">
            <Synth />
          </div>
        )}

        {/* DRUMS */}
        {bottomTab === 'drums' && (
          <div className="h-56 overflow-auto p-2">
            <DrumMachine bpm={bpm} />
          </div>
        )}

        {/* PIANO ROLL */}
        {bottomTab === 'piano' && (
          <div className="h-56 overflow-auto p-2">
            <PianoRoll bpm={bpm} />
          </div>
        )}

        {bottomTab === 'chords' && (
          <div className="h-56 overflow-auto p-2">
            <ChordGenerator />
          </div>
        )}

        {bottomTab === 'bass' && (
          <div className="h-56 overflow-auto p-2">
            <BassSynth />
          </div>
        )}
      </div>

      {/* Export Dialog */}
      {showExport && (
        <ExportDialog
          tracks={tracks.map(t => ({ name: t.name, url: t.audioUrl, volume: t.volume - 80, pan: t.pan, mute: t.mute }))}
          title={store.project?.title || 'My Song'}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
