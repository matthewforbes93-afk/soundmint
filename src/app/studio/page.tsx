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
import AutomationLane from '@/components/AutomationLane';
import ChordGenerator from '@/components/ChordGenerator';
import BassSynth from '@/components/BassSynth';
import AnalysisPanel from '@/components/AnalysisPanel';
import ExportDialog from '@/components/ExportDialog';
import { useMetronome } from '@/lib/useMetronome';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';

// ─── WAV Encoder ───
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const writeStr = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, length - 8, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true); writeStr(36, 'data'); view.setUint32(40, length - 44, true);
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return out;
}

// ─── Types ───
interface TrackLane {
  id: string;
  name: string;
  color: string;
  type: 'audio' | 'midi' | 'ai';
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  armed: boolean;
  audioUrl: string | null;
  waveform: number[];
  effects: { eq: [number, number, number]; comp: number; reverb: number; delay: number; chorus: number };
  showAutomation: boolean;
  automationParam: 'volume' | 'pan' | 'reverb';
  automationPoints: { bar: number; value: number }[];
}

// SoundMint palette — mint, teal, emerald, purple accents
const COLORS = ['#34d399','#2dd4bf','#a78bfa','#22d3ee','#4ade80','#818cf8','#67e8f9','#6ee7b7','#c084fc','#5eead4'];

function wave(n: number = 300): number[] {
  // Seeded pseudo-random for SSR/client consistency
  let seed = n * 7 + 13;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed & 0x7fffffff) / 2147483647; };
  const w: number[] = [];
  for (let i = 0; i < n; i++) {
    const base = Math.sin(i * 0.05) * 0.3 + 0.5;
    w.push(base + (rand() - 0.5) * 0.4);
  }
  return w;
}

function mkTrack(name: string, i: number, type: TrackLane['type'] = 'audio', hasWave = false): TrackLane {
  return {
    id: `t-${i}-${name.replace(/\s/g, '')}`,
    name, color: COLORS[i % COLORS.length], type,
    volume: 80, pan: 0, mute: false, solo: false, armed: false,
    audioUrl: null, waveform: hasWave ? wave() : [],
    effects: { eq: [0, 0, 0], comp: 0, reverb: 0, delay: 0, chorus: 0 },
    showAutomation: false,
    automationParam: 'volume',
    automationPoints: [],
  };
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
  track: TrackLane; meters: [number, number]; onUpdate: (u: Partial<TrackLane>) => void; selected: boolean; onSelect: () => void;
}) {
  return (
    <div onClick={onSelect}
      className={`w-[72px] flex-shrink-0 flex flex-col items-center rounded-xl border transition-all cursor-pointer ${
        selected ? 'bg-white/[0.04] border-purple-500/30 shadow-lg shadow-purple-500/5' : 'bg-white/[0.02] border-white/5 hover:border-white/10'
      }`}>
      {/* Track name */}
      <div className="w-full px-2 pt-2 pb-1">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: track.color }} />
          <span className="text-[9px] text-gray-300 font-medium truncate">{track.name}</span>
        </div>
        <span className="text-[8px] text-gray-600">{track.type.toUpperCase()}</span>
      </div>

      {/* Pan knob */}
      <Knob value={track.pan} onChange={(v) => onUpdate({ pan: v })} label="Pan" min={-100} max={100} color="cyan" />

      {/* Fader + Meters */}
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

      {/* M / S / R buttons */}
      <div className="flex gap-0.5 pb-2">
        <button onClick={(e) => { e.stopPropagation(); onUpdate({ mute: !track.mute }); }}
          className={`text-[8px] w-5 h-5 rounded font-bold flex items-center justify-center ${track.mute ? 'bg-red-500/40 text-red-300' : 'bg-white/5 text-gray-600 hover:text-gray-300'}`}>M</button>
        <button onClick={(e) => { e.stopPropagation(); onUpdate({ solo: !track.solo }); }}
          className={`text-[8px] w-5 h-5 rounded font-bold flex items-center justify-center ${track.solo ? 'bg-yellow-500/40 text-yellow-300' : 'bg-white/5 text-gray-600 hover:text-gray-300'}`}>S</button>
        <button onClick={(e) => { e.stopPropagation(); onUpdate({ armed: !track.armed }); }}
          className={`text-[8px] w-5 h-5 rounded font-bold flex items-center justify-center ${track.armed ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-600 hover:text-gray-300'}`}>R</button>
      </div>
    </div>
  );
}

// ═══ MAIN STUDIO PAGE ═══
export default function StudioPage() {
  const [tracks, setTracks] = useState<TrackLane[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [key, setKey] = useState('C');
  const [timeSig, setTimeSig] = useState('4/4');
  const [looping, setLooping] = useState(false);
  const [pos, setPos] = useState(0); // seconds
  const [selected, setSelected] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'mixer' | 'fx' | 'browser' | 'synth' | 'drums' | 'piano' | 'chords' | 'bass'>('mixer');
  const [zoom, setZoom] = useState(1);
  const [meters, setMeters] = useState<Record<string, [number, number]>>({});
  const animRef = useRef(0);
  const startRef = useRef(0);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const trackHistoryRef = useRef<TrackLane[][]>([]);
  const trackHistoryIdxRef = useRef(-1);

  function pushHistory(newTracks: TrackLane[]) {
    trackHistoryRef.current = trackHistoryRef.current.slice(0, trackHistoryIdxRef.current + 1);
    trackHistoryRef.current.push(JSON.parse(JSON.stringify(newTracks)));
    if (trackHistoryRef.current.length > 30) trackHistoryRef.current.shift();
    else trackHistoryIdxRef.current++;
  }

  function undo() {
    if (trackHistoryIdxRef.current > 0) {
      trackHistoryIdxRef.current--;
      setTracks(JSON.parse(JSON.stringify(trackHistoryRef.current[trackHistoryIdxRef.current])));
    }
  }

  function redo() {
    if (trackHistoryIdxRef.current < trackHistoryRef.current.length - 1) {
      trackHistoryIdxRef.current++;
      setTracks(JSON.parse(JSON.stringify(trackHistoryRef.current[trackHistoryIdxRef.current])));
    }
  }
  const [sections, setSections] = useState<{ id: string; name: string; startBar: number; color: string }[]>([]);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Record<string, {
    source: AudioBufferSourceNode | null;
    gain: GainNode;
    pan: StereoPannerNode;
    eqLow: BiquadFilterNode;
    eqMid: BiquadFilterNode;
    eqHigh: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    reverb: GainNode; // dry/wet mix for reverb send
  }>>({});
  const metronome = useMetronome();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    ' ': () => { setPlaying(p => !p); setRecording(false); },
    'r': () => { if (recording) stopStudioRecording(); else startStudioRecording(); },
    'm': () => setMetronomeOn(m => !m),
    'cmd+z': undo,
    'cmd+shift+z': redo,
  });

  // Metronome
  useEffect(() => {
    if (playing && metronomeOn) {
      metronome.start(bpm);
    } else {
      metronome.stop();
    }
    return () => metronome.stop();
  }, [playing, metronomeOn, bpm, metronome]);

  // In-studio recording
  async function startStudioRecording() {
    // Find armed track, or auto-arm the selected/first track
    let armedTrack = tracks.find(t => t.armed);
    if (!armedTrack) {
      const targetId = selected || tracks[0]?.id;
      if (!targetId) return;
      // Arm it directly in our local reference
      armedTrack = tracks.find(t => t.id === targetId);
      if (!armedTrack) return;
      armedTrack = { ...armedTrack, armed: true };
      setTracks(prev => prev.map(t => ({ ...t, armed: t.id === targetId })));
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      // Live input monitoring — connect mic to analyser for visual feedback
      const audioCtx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      // Store analyser for level metering
      (window as unknown as Record<string, unknown>).__recAnalyser = analyser;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        (window as unknown as Record<string, unknown>).__recAnalyser = null;
        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (webmBlob.size < 1000) return; // Too short, discard

        // Convert WebM to WAV so Web Audio can decode it later
        let file: File;
        try {
          const convCtx = new AudioContext();
          const arrayBuf = await webmBlob.arrayBuffer();
          const audioBuf = await convCtx.decodeAudioData(arrayBuf);
          const wavBuf = audioBufferToWav(audioBuf);
          const wavBlob = new Blob([wavBuf], { type: 'audio/wav' });
          file = new File([wavBlob], `studio-rec-${Date.now()}.wav`, { type: 'audio/wav' });
          convCtx.close();
        } catch {
          // Fallback: upload as webm anyway
          file = new File([webmBlob], `studio-rec-${Date.now()}.webm`, { type: 'audio/webm' });
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', armedTrack.name);
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (res.ok && data.audio_url) {
            setTracks(prev => prev.map(t =>
              t.id === armedTrack.id ? { ...t, audioUrl: data.audio_url, waveform: wave(), armed: false } : t
            ));
          }
        } catch (err) { console.error('Upload failed:', err); }
      };
      // Count-in: 4 clicks before recording starts
      setMetronomeOn(true);
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      let countIn = 4;
      const countInterval = setInterval(() => {
        // Click sound for count-in
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = countIn === 4 ? 1200 : 900;
        g.gain.setValueAtTime(0.6, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start(); osc.stop(ctx.currentTime + 0.05);

        countIn--;
        if (countIn <= 0) {
          clearInterval(countInterval);
          recorder.start(100);
          setRecordingTrackId(armedTrack.id);
          setRecording(true);
          setPlaying(true);
        }
      }, (60 / bpm) * 1000);
    } catch (err) {
      console.error('Mic access denied:', err);
      // Show visual feedback
      setRecording(false);
    }
  }

  function stopStudioRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecordingTrackId(null);
    setRecording(false);
    setPlaying(false);
    setPos(0);
    // After a short delay, tracks will have updated audioUrl from the onstop handler
    // The user can immediately hit play to hear their recording
  }

  // Load real tracks from API + add empty tracks for new recordings
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      // Fetch real tracks with audio
      fetch('/api/tracks').then(r => r.json()).then((apiTracks: Array<{id: string; title: string; audio_url: string | null; genre: string}>) => {
        const realTracks: TrackLane[] = [];
        const playable = (apiTracks || []).filter(t => t.audio_url);

        // Add real tracks from library
        playable.slice(0, 4).forEach((t, i) => {
          const track = mkTrack(t.title, i, 'audio', true);
          track.id = t.id;
          track.audioUrl = t.audio_url;
          realTracks.push(track);
        });

        // Add empty tracks for recording
        if (realTracks.length < 2) {
          realTracks.push(mkTrack('Audio 1', realTracks.length, 'audio', false));
        }
        realTracks.push(mkTrack('Record Here', realTracks.length, 'audio', false));

        setTracks(realTracks);
      }).catch(() => {
        // Fallback if API fails
        setTracks([
          mkTrack('Audio 1', 0, 'audio', false),
          mkTrack('Record Here', 1, 'audio', false),
        ]);
      });
    }
  }, [initialized]);

  // Update ALL audio nodes in real-time when track settings change
  useEffect(() => {
    tracks.forEach(track => {
      const nodes = audioSourcesRef.current[track.id];
      if (!nodes) return;

      // Volume + mute
      nodes.gain.gain.value = track.mute ? 0 : track.volume / 100;

      // Pan
      nodes.pan.pan.value = track.pan / 100;

      // EQ (real-time)
      nodes.eqLow.gain.value = track.effects.eq[0];
      nodes.eqMid.gain.value = track.effects.eq[1];
      nodes.eqHigh.gain.value = track.effects.eq[2];

      // Compressor threshold (real-time)
      nodes.compressor.threshold.value = -24 + (track.effects.comp / 100) * 24;

      // Reverb send level (real-time)
      nodes.reverb.gain.value = track.effects.reverb / 100;
    });
  }, [tracks]);

  // REAL AUDIO PLAYBACK + animate playhead + meters
  useEffect(() => {
    if (playing) {
      // Create AudioContext if needed
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;

      // Start playing all tracks with audio
      tracks.forEach(async (track) => {
        if (!track.audioUrl || track.mute) return;
        if (audioSourcesRef.current[track.id]?.source) return; // Already playing
        // Skip webm files — Web Audio can't decode them reliably
        if (track.audioUrl.endsWith('.webm')) return;

        try {
          const res = await fetch(track.audioUrl);
          if (!res.ok) return;
          const arrayBuf = await res.arrayBuffer();
          if (arrayBuf.byteLength < 100) return; // Too small / empty
          const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0)); // slice to avoid detached buffer

          const source = ctx.createBufferSource();
          const gain = ctx.createGain();
          const pan = ctx.createStereoPanner();

          // EQ: 3-band (low shelf, peaking mid, high shelf)
          const eqLow = ctx.createBiquadFilter();
          eqLow.type = 'lowshelf';
          eqLow.frequency.value = 320;
          eqLow.gain.value = track.effects.eq[0];

          const eqMid = ctx.createBiquadFilter();
          eqMid.type = 'peaking';
          eqMid.frequency.value = 1000;
          eqMid.Q.value = 1;
          eqMid.gain.value = track.effects.eq[1];

          const eqHigh = ctx.createBiquadFilter();
          eqHigh.type = 'highshelf';
          eqHigh.frequency.value = 3200;
          eqHigh.gain.value = track.effects.eq[2];

          // Compressor
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -24 + (track.effects.comp / 100) * 24; // 0 = -24dB, 100 = 0dB
          compressor.ratio.value = 4;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;

          // Reverb send (simple delay-based)
          const reverb = ctx.createGain();
          reverb.gain.value = track.effects.reverb / 100;

          source.buffer = audioBuf;
          source.loop = true;
          gain.gain.value = track.mute ? 0 : track.volume / 100;
          pan.pan.value = track.pan / 100;

          // Chain: source → eqLow → eqMid → eqHigh → compressor → gain → pan → destination
          source.connect(eqLow);
          eqLow.connect(eqMid);
          eqMid.connect(eqHigh);
          eqHigh.connect(compressor);
          compressor.connect(gain);
          gain.connect(pan);
          pan.connect(ctx.destination);

          // Reverb send: source → reverb gain → delay → destination
          if (track.effects.reverb > 0) {
            const delay = ctx.createDelay();
            delay.delayTime.value = 0.03;
            const fbGain = ctx.createGain();
            fbGain.gain.value = 0.4;
            source.connect(reverb);
            reverb.connect(delay);
            delay.connect(fbGain);
            fbGain.connect(delay); // feedback loop
            delay.connect(ctx.destination);
          }

          source.start(0);

          audioSourcesRef.current[track.id] = { source, gain, pan, eqLow, eqMid, eqHigh, compressor, reverb };
        } catch (err) {
          console.error(`Failed to play track ${track.name}:`, err);
        }
      });

      // Animate playhead + real meters
      startRef.current = performance.now() - pos * 1000;
      const tick = () => {
        const t = (performance.now() - startRef.current) / 1000;
        setPos(t);
        const m: Record<string, [number, number]> = {};
        tracks.forEach(tr => {
          if (tr.mute || !tr.audioUrl) { m[tr.id] = [0, 0]; return; }
          // Real-ish meters based on volume
          const base = (tr.volume / 100) * 0.6;
          m[tr.id] = [base + Math.random() * 0.3, base + Math.random() * 0.3];
        });
        setMeters(m);
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    } else {
      // Stop all audio
      cancelAnimationFrame(animRef.current);
      Object.values(audioSourcesRef.current).forEach(({ source }) => {
        try { source?.stop(); } catch { /* already stopped */ }
      });
      audioSourcesRef.current = {};
      const m: Record<string, [number, number]> = {};
      tracks.forEach(tr => { m[tr.id] = [0, 0]; });
      setMeters(m);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [playing]);

  function upd(id: string, u: Partial<TrackLane>) {
    setTracks(p => {
      const next = p.map(t => t.id === id ? { ...t, ...u } : t);
      pushHistory(next);
      return next;
    });
  }

  function addTrack(type: TrackLane['type']) {
    const n = tracks.length;
    const names: Record<string, string> = { audio: `Audio ${n+1}`, midi: `MIDI ${n+1}`, ai: `AI ${n+1}` };
    const track = mkTrack(names[type], n, type, type === 'ai');
    track.id = `t-new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setTracks(p => [...p, track]);
  }

  const bar = Math.floor(pos * bpm / 60 / 4) + 1;
  const beat = Math.floor(pos * bpm / 60) % 4 + 1;
  const mins = Math.floor(pos / 60);
  const secs = (pos % 60).toFixed(1);
  const totalBars = 32;
  const pxPerBar = 80 * zoom;
  const playPx = (pos * bpm / 60 / 4) * pxPerBar;

  // Master meter
  const masterL = playing ? Math.min(0.95, tracks.reduce((s, t) => s + (meters[t.id]?.[0] || 0), 0) / Math.max(tracks.length, 1) * 1.5) : 0;
  const masterR = playing ? Math.min(0.95, tracks.reduce((s, t) => s + (meters[t.id]?.[1] || 0), 0) / Math.max(tracks.length, 1) * 1.5) : 0;

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
            <input type="number" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
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
          <button onClick={undo} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/5" title="Undo (Cmd+Z)"><Undo2 className="w-3.5 h-3.5" /></button>
          <button onClick={redo} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/5" title="Redo (Cmd+Shift+Z)"><Redo2 className="w-3.5 h-3.5" /></button>
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
                    <button onClick={(e) => { e.stopPropagation(); setTracks(p => p.filter(t => t.id !== track.id)); }}
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

              {/* Automation Lane */}
              {track.showAutomation && (
                <AutomationLane
                  label={`${track.name} → ${track.automationParam}`}
                  color={track.color}
                  points={track.automationPoints}
                  totalBars={totalBars}
                  pxPerBar={pxPerBar}
                  onChange={(points) => upd(track.id, { automationPoints: points })}
                />
              )}
            </React.Fragment>
          ))}

            {/* Add track */}
            <div className="h-10 flex items-center border-b border-white/[0.03]">
              <div className="w-52 flex-shrink-0 border-r border-white/5 px-3 flex gap-1.5">
                {[
                  { type: 'audio' as const, icon: Mic, label: 'Audio', color: 'text-green-500' },
                  { type: 'midi' as const, icon: Piano, label: 'MIDI', color: 'text-blue-500' },
                  { type: 'ai' as const, icon: Wand2, label: 'AI', color: 'text-pink-500' },
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
        <div className="h-7 flex items-center px-2 gap-0.5 border-b border-white/[0.03]">
          {[
            { id: 'mixer' as const, label: 'Mixer', icon: SlidersIcon },
            { id: 'fx' as const, label: 'Effects', icon: Activity },
            { id: 'synth' as const, label: 'Synth', icon: Keyboard },
            { id: 'drums' as const, label: 'Drums', icon: Drum },
            { id: 'piano' as const, label: 'Piano Roll', icon: Piano },
            { id: 'chords' as const, label: 'Chords', icon: Music },
            { id: 'bass' as const, label: '808 Bass', icon: Volume2 },
            { id: 'browser' as const, label: 'Sounds', icon: Music },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setBottomTab(id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                bottomTab === id ? 'bg-white/[0.06] text-white' : 'text-gray-600 hover:text-gray-300'
              }`}>
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
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
              <Knob value={80} onChange={() => {}} label="Vol" color="mint" />
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
                      {(['LOW', 'MID', 'HIGH'] as const).map((band, i) => (
                        <div key={band} className="flex flex-col items-center">
                          <Knob value={t.effects.eq[i]} onChange={(v) => {
                            const eq: [number, number, number] = [...t.effects.eq];
                            eq[i] = v;
                            upd(t.id, { effects: { ...t.effects, eq } });
                          }} label={band} min={-12} max={12} color="purple" />
                          <span className="text-[8px] text-gray-600 mt-1">{t.effects.eq[i] > 0 ? '+' : ''}{t.effects.eq[i]}dB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Dynamics */}
                  <div className="flex-1 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-blue-400 font-bold mb-3">COMPRESSOR</p>
                    <div className="flex gap-4 items-end justify-center h-24">
                      <Knob value={t.effects.comp} onChange={(v) => upd(t.id, { effects: { ...t.effects, comp: v } })} label="Amount" color="blue" />
                    </div>
                  </div>
                  {/* Reverb */}
                  <div className="flex-1 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-teal-400 font-bold mb-3">REVERB</p>
                    <div className="flex gap-4 items-end justify-center h-24">
                      <Knob value={t.effects.reverb} onChange={(v) => upd(t.id, { effects: { ...t.effects, reverb: v } })} label="Size" color="green" />
                    </div>
                  </div>
                  {/* Delay */}
                  <div className="flex-1 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-yellow-400 font-bold mb-3">DELAY</p>
                    <div className="flex gap-4 items-end justify-center h-24">
                      <Knob value={t.effects.delay} onChange={(v) => upd(t.id, { effects: { ...t.effects, delay: v } })} label="Time" color="yellow" />
                    </div>
                  </div>
                  {/* Chorus */}
                  <div className="flex-1 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-pink-400 font-bold mb-3">CHORUS</p>
                    <div className="flex gap-4 items-end justify-center h-24">
                      <Knob value={t.effects.chorus} onChange={(v) => upd(t.id, { effects: { ...t.effects, chorus: v } })} label="Depth" color="pink" />
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="h-full flex items-center gap-4 px-4">
                <span className="text-gray-700 text-sm">Select a track to edit effects</span>
                <AnalysisPanel audioUrl={tracks.find(t => t.audioUrl)?.audioUrl || null} />
              </div>
            )}
          </div>
        )}

        {/* BROWSER */}
        {bottomTab === 'browser' && (
          <div className="h-56 p-3 overflow-auto">
            <div className="grid grid-cols-6 gap-1.5">
              {['Kick 808', 'Snare Crack', 'Hi-Hat Closed', 'Hi-Hat Open', 'Clap', 'Rim Shot',
                'Bass Sub', 'Bass Pluck', 'Piano Chord', 'Guitar Clean', 'Guitar Dist', 'Strings Pad',
                'Synth Lead', 'Synth Pad', 'Vocal Chop', 'Ad-Lib', 'FX Riser', 'FX Impact',
                'Brass Stab', 'Flute Melody', 'Bell Chime', 'Percussion', 'Shaker', 'Vinyl Noise',
              ].map(sample => (
                <button key={sample}
                  onClick={() => {
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    gain.gain.value = 0.3;
                    osc.frequency.value = 200 + Math.random() * 600;
                    osc.start();
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                    osc.stop(ctx.currentTime + 0.3);
                  }}
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
          title="My Song"
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
