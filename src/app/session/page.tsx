'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Play, Pause, Square, Download, Check, ChevronRight,
  PenTool, Radio, Grid3X3, Loader2, RotateCcw, Zap, X, Wand2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BeatPlayer, type BeatConfig } from '@/lib/beatFactory';

// ─── Types ───
type Door = null | 'write' | 'record' | 'build';
type Phase = 'doors' | 'setup' | 'creating' | 'booth' | 'mix' | 'done';

const VOCAL_PRESETS: Record<string, { label: string; eq: [number, number, number]; reverb: number; comp: number }> = {
  raw:       { label: 'Raw',       eq: [0, 0, 0],    reverb: 0,   comp: 0 },
  warm:      { label: 'Warm',      eq: [3, 0, -2],   reverb: 15,  comp: 40 },
  airy:      { label: 'Airy',      eq: [-2, 2, 4],   reverb: 30,  comp: 20 },
  dark:      { label: 'Dark',      eq: [4, -1, -4],  reverb: 20,  comp: 50 },
  radio:     { label: 'Radio',     eq: [1, 3, 2],    reverb: 10,  comp: 70 },
  intimate:  { label: 'Intimate',  eq: [2, 1, -1],   reverb: 25,  comp: 30 },
};

const AUTOTUNE_PRESETS: Record<string, { label: string; desc: string; speed: number; detune: number; chorusDepth: number }> = {
  off:       { label: 'Off',        desc: 'No pitch correction',              speed: 0,    detune: 0,   chorusDepth: 0 },
  subtle:    { label: 'Subtle',     desc: 'Light correction, natural feel',   speed: 0.3,  detune: 5,   chorusDepth: 0.1 },
  modern:    { label: 'Modern',     desc: 'Pop/R&B standard correction',      speed: 0.6,  detune: 10,  chorusDepth: 0.2 },
  hard:      { label: 'Hard',       desc: 'T-Pain / Future style snap',       speed: 1.0,  detune: 15,  chorusDepth: 0.3 },
  robot:     { label: 'Robot',      desc: 'Extreme effect, Daft Punk vibes',  speed: 1.0,  detune: 25,  chorusDepth: 0.5 },
  harmony:   { label: 'Harmony',    desc: 'Adds a 3rd and 5th above',        speed: 0.5,  detune: 0,   chorusDepth: 0.4 },
};

const SPACE_PRESETS: Record<string, { label: string; reverb: number }> = {
  dry:       { label: 'Dry',       reverb: 0 },
  room:      { label: 'Room',      reverb: 20 },
  hall:      { label: 'Hall',      reverb: 50 },
  cathedral: { label: 'Cathedral', reverb: 80 },
};

// Smart genre detection from title
function detectFromTitle(title: string): { genre: string; mood: string; bpm: number } {
  const t = title.toLowerCase();
  const gMap: Record<string, string[]> = {
    trap: ['trap','drip','ice','gang','plug'], rap: ['bars','flow','spit','freestyle'],
    'hip-hop': ['hood','street','hustle','grind'], 'r&b': ['love','heart','baby','feel','kiss'],
    pop: ['dance','party','summer','happy'], 'lo-fi': ['chill','study','rain','coffee','sleep'],
    electronic: ['rave','bass','drop','synth'], jazz: ['smooth','jazz','groove'],
    cinematic: ['epic','hero','rise','battle'], afrobeat: ['vibe','africa','rhythm'],
  };
  let genre = 'hip-hop';
  for (const [g, kw] of Object.entries(gMap)) { if (kw.some(k => t.includes(k))) { genre = g; break; } }

  const mMap: Record<string, string[]> = {
    aggressive: ['angry','rage','war','hard'], dark: ['dark','shadow','night','demon'],
    uplifting: ['rise','shine','hero','fly'], romantic: ['love','heart','baby','kiss'],
    energetic: ['party','dance','hype','lit'], chill: ['chill','relax','vibe','cool'],
    dreamy: ['dream','cloud','star','moon'], epic: ['epic','battle','legend'],
  };
  let mood = 'chill';
  for (const [m, kw] of Object.entries(mMap)) { if (kw.some(k => t.includes(k))) { mood = m; break; } }

  const bpmMap: Record<string, number> = {
    trap: 140, rap: 130, 'hip-hop': 90, 'r&b': 75, pop: 120,
    'lo-fi': 80, electronic: 128, jazz: 100, cinematic: 95, afrobeat: 110,
  };
  return { genre, mood, bpm: bpmMap[genre] || 90 };
}

// WAV encoder
function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const ch = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length * ch * 2 + 44;
  const out = new ArrayBuffer(len), v = new DataView(out);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0,'RIFF'); v.setUint32(4,len-8,true); ws(8,'WAVE'); ws(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,ch,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*ch*2,true); v.setUint16(32,ch*2,true);
  v.setUint16(34,16,true); ws(36,'data'); v.setUint32(40,len-44,true);
  let off = 44;
  for (let i = 0; i < buffer.length; i++) for (let c = 0; c < ch; c++) {
    v.setInt16(off, Math.max(-1, Math.min(1, buffer.getChannelData(c)[i])) * 0x7FFF, true); off += 2;
  }
  return out;
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function SessionPage() {
  const [door, setDoor] = useState<Door>(null);
  const [phase, setPhase] = useState<Phase>('doors');
  const [artistName, setArtistName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [genre, setGenre] = useState('hip-hop');
  const [mood, setMood] = useState('chill');
  const [bpm, setBpm] = useState(90);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [vocalPreset, setVocalPreset] = useState('warm');
  const [spacePreset, setSpacePreset] = useState('room');
  const [beatVolume, setBeatVolume] = useState(70);
  const [vocalVolume, setVocalVolume] = useState(100);
  const [beatUrl, setBeatUrl] = useState<string | null>(null);
  const [vocalUrl, setVocalUrl] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [vizData, setVizData] = useState<number[]>(new Array(64).fill(0));
  const [lyrics, setLyrics] = useState('');
  const [autotunePreset, setAutotunePreset] = useState('off');
  const vocalChainRef = useRef<{ ctx: AudioContext; source: MediaElementAudioSourceNode } | null>(null);

  const beatPlayerRef = useRef<BeatPlayer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const vocalAudioRef = useRef<HTMLAudioElement>(null);

  // Title change → auto detect
  function handleTitle(t: string) {
    setSongTitle(t);
    if (t.length > 2) {
      const d = detectFromTitle(t);
      setGenre(d.genre); setMood(d.mood); setBpm(d.bpm);
    }
  }

  // Start beat — AI audio or instant synthesis
  function startBeat() {
    if (beatUrl) {
      // Play AI-generated beat
      const el = document.getElementById('aiBeatAudio') as HTMLAudioElement | null;
      if (el) { el.volume = beatVolume / 100; el.currentTime = 0; el.play(); }
    } else {
      // Instant synthesis
      beatPlayerRef.current?.destroy();
      const keys = ['C','D','E','F','G','A'];
      beatPlayerRef.current = new BeatPlayer({ genre, mood, bpm, key: keys[Math.floor(Math.random() * keys.length)] });
      beatPlayerRef.current.setVolume(beatVolume / 100);
      beatPlayerRef.current.start();
    }
    setIsPlaying(true);
  }

  function stopBeat() {
    if (beatUrl) {
      const el = document.getElementById('aiBeatAudio') as HTMLAudioElement | null;
      if (el) el.pause();
    } else {
      beatPlayerRef.current?.stop();
    }
    setIsPlaying(false);
  }

  // Start recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      // ═══ LIVE MONITORING — hear yourself with effects while recording ═══
      const preset = VOCAL_PRESETS[vocalPreset] || VOCAL_PRESETS.raw;
      const tune = AUTOTUNE_PRESETS[autotunePreset] || AUTOTUNE_PRESETS.off;

      // Build live monitoring chain: mic → EQ → comp → gain → effects → output
      const monEqLow = ctx.createBiquadFilter(); monEqLow.type = 'lowshelf'; monEqLow.frequency.value = 300; monEqLow.gain.value = preset.eq[0];
      const monEqMid = ctx.createBiquadFilter(); monEqMid.type = 'peaking'; monEqMid.frequency.value = 1500; monEqMid.Q.value = 1; monEqMid.gain.value = preset.eq[1];
      const monEqHigh = ctx.createBiquadFilter(); monEqHigh.type = 'highshelf'; monEqHigh.frequency.value = 4000; monEqHigh.gain.value = preset.eq[2];
      const monComp = ctx.createDynamicsCompressor();
      monComp.threshold.value = -24 + (preset.comp / 100) * 20; monComp.ratio.value = 4;
      const monGain = ctx.createGain(); monGain.gain.value = 0.8;

      source.connect(monEqLow); monEqLow.connect(monEqMid); monEqMid.connect(monEqHigh);
      monEqHigh.connect(monComp); monComp.connect(monGain);

      // Add autotune to monitoring
      if (tune.speed > 0) {
        const dryG = ctx.createGain(); dryG.gain.value = 1 - tune.chorusDepth * 0.4;
        monGain.connect(dryG); dryG.connect(ctx.destination);
        [tune.detune, -tune.detune].forEach(cents => {
          const del = ctx.createDelay(); del.delayTime.value = 0.003;
          const sG = ctx.createGain(); sG.gain.value = tune.chorusDepth;
          const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
          lfo.frequency.value = 0.5 + tune.speed * 3; lfoG.gain.value = cents / 12000;
          lfo.connect(lfoG); lfoG.connect(del.delayTime); lfo.start();
          monGain.connect(del); del.connect(sG); sG.connect(ctx.destination);
        });
      } else {
        monGain.connect(ctx.destination);
      }

      // Reverb on monitoring
      if (preset.reverb > 0) {
        const rG = ctx.createGain(); rG.gain.value = preset.reverb / 150;
        const d1 = ctx.createDelay(); d1.delayTime.value = 0.02;
        const d2 = ctx.createDelay(); d2.delayTime.value = 0.04;
        const fb = ctx.createGain(); fb.gain.value = 0.2;
        monGain.connect(d1); d1.connect(d2); d2.connect(fb); fb.connect(d1);
        d1.connect(rG); d2.connect(rG); rG.connect(ctx.destination);
      }

      // Start visualizer
      const vizTick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setVizData(Array.from(data).map(v => v / 255));
        animRef.current = requestAnimationFrame(vizTick);
      };
      animRef.current = requestAnimationFrame(vizTick);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        cancelAnimationFrame(animRef.current);
        stream.getTracks().forEach(t => t.stop());
        setVizData(new Array(64).fill(0));
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 500) return;

        // Convert to WAV
        try {
          const arrBuf = await blob.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrBuf);
          const wavBuf = encodeWav(audioBuf);
          const file = new File([wavBuf], `vocal-${Date.now()}.wav`, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append('file', file);
          formData.append('title', `${songTitle} - Vocals`);
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (res.ok) {
            setVocalUrl(data.audio_url);
            toast.success('Recording saved');
            setPhase('mix');
          }
        } catch { toast.error('Save failed'); }
      };

      // Start beat + recording
      startBeat();
      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { toast.error('Mic access denied'); }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    stopBeat();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // Mix playback
  function playMix() {
    // Beat
    beatPlayerRef.current?.destroy();
    const keys = ['C','D','E','F','G','A'];
    beatPlayerRef.current = new BeatPlayer({ genre, mood, bpm, key: keys[Math.floor(Math.random() * keys.length)] });
    beatPlayerRef.current.setVolume(beatVolume / 100);
    beatPlayerRef.current.start();

    // Vocals through real effects chain
    if (vocalAudioRef.current && vocalUrl) {
      try {
        const ctx = vocalChainRef.current?.ctx || new AudioContext();
        let source: MediaElementAudioSourceNode;
        if (vocalChainRef.current?.ctx === ctx) {
          source = vocalChainRef.current.source;
          try { source.disconnect(); } catch {/* ok */}
        } else {
          source = ctx.createMediaElementSource(vocalAudioRef.current);
        }
        vocalChainRef.current = { ctx, source };

        const preset = VOCAL_PRESETS[vocalPreset] || VOCAL_PRESETS.raw;
        const tune = AUTOTUNE_PRESETS[autotunePreset] || AUTOTUNE_PRESETS.off;

        // EQ
        const eqLow = ctx.createBiquadFilter(); eqLow.type = 'lowshelf'; eqLow.frequency.value = 300; eqLow.gain.value = preset.eq[0];
        const eqMid = ctx.createBiquadFilter(); eqMid.type = 'peaking'; eqMid.frequency.value = 1500; eqMid.Q.value = 1; eqMid.gain.value = preset.eq[1];
        const eqHigh = ctx.createBiquadFilter(); eqHigh.type = 'highshelf'; eqHigh.frequency.value = 4000; eqHigh.gain.value = preset.eq[2];

        // Compressor
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -24 + (preset.comp / 100) * 20;
        comp.ratio.value = 4;

        // Volume
        const gain = ctx.createGain();
        gain.gain.value = vocalVolume / 100;

        // Chain: source → EQ → comp → gain
        source.connect(eqLow); eqLow.connect(eqMid); eqMid.connect(eqHigh); eqHigh.connect(comp); comp.connect(gain);

        // Autotune (pitch-shifted chorus layers)
        if (tune.speed > 0) {
          const dryGain = ctx.createGain();
          dryGain.gain.value = 1.0 - tune.chorusDepth * 0.4;
          gain.connect(dryGain);
          dryGain.connect(ctx.destination);

          const shifts = [tune.detune, -tune.detune];
          if (autotunePreset === 'harmony') { shifts.push(tune.detune * 2.5, tune.detune * 4); }

          shifts.forEach(cents => {
            const del = ctx.createDelay(); del.delayTime.value = 0.003 + Math.random() * 0.004;
            const sGain = ctx.createGain(); sGain.gain.value = tune.chorusDepth;
            const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
            lfo.frequency.value = 0.5 + tune.speed * 3;
            lfoG.gain.value = cents / 12000;
            lfo.connect(lfoG); lfoG.connect(del.delayTime); lfo.start();
            gain.connect(del); del.connect(sGain); sGain.connect(ctx.destination);
          });
        } else {
          gain.connect(ctx.destination);
        }

        // Reverb
        if (preset.reverb > 0) {
          const rGain = ctx.createGain(); rGain.gain.value = preset.reverb / 150;
          const d1 = ctx.createDelay(); d1.delayTime.value = 0.02;
          const d2 = ctx.createDelay(); d2.delayTime.value = 0.04;
          const fb = ctx.createGain(); fb.gain.value = 0.2;
          gain.connect(d1); d1.connect(d2); d2.connect(fb); fb.connect(d1);
          d1.connect(rGain); d2.connect(rGain); rGain.connect(ctx.destination);
        }

        vocalAudioRef.current.currentTime = 0;
        vocalAudioRef.current.play();
      } catch {
        if (vocalAudioRef.current) { vocalAudioRef.current.volume = vocalVolume / 100; vocalAudioRef.current.currentTime = 0; vocalAudioRef.current.play(); }
      }
    }
    setIsPlaying(true);
  }

  function stopAll() {
    beatPlayerRef.current?.stop();
    vocalAudioRef.current?.pause();
    setIsPlaying(false);
  }

  // Export
  async function exportSong() {
    setExporting(true);
    try {
      const trackUrls = [];
      if (vocalUrl) trackUrls.push({ url: vocalUrl, name: 'Vocals', volume: 0, pan: 0, mute: false });
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackUrls, format: 'mp3', master: true, title: songTitle }),
      });
      const data = await res.json();
      if (res.ok) { setExportUrl(data.audio_url); setPhase('done'); toast.success('Exported!'); }
    } catch { toast.error('Export failed'); }
    setExporting(false);
  }

  function formatTime(s: number) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

  function reset() {
    stopAll();
    setDoor(null); setPhase('doors'); setVocalUrl(null); setExportUrl(null);
    setSongTitle(''); setRecordingTime(0);
  }

  // Cleanup
  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    beatPlayerRef.current?.destroy();
  }, []);

  // ═══ RENDER ═══
  return (
    <div className="h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full transition-all duration-1000 ${
          isRecording ? 'bg-red-500/[0.03] scale-110' : 'bg-teal-500/[0.02] scale-100'
        } blur-3xl`} />
      </div>

      {/* ═══ TOP BAR — always visible except doors ═══ */}
      {phase !== 'doors' && (
        <div className="relative z-20 h-12 flex items-center justify-between px-4 border-b border-white/5 flex-shrink-0">
          <button onClick={() => {
            if (phase === 'setup') { setPhase('doors'); setDoor(null); }
            else if (phase === 'booth') { stopAll(); setPhase('setup'); }
            else if (phase === 'mix') { stopAll(); setPhase('booth'); }
            else if (phase === 'done') { setPhase('mix'); }
            else { setPhase('doors'); setDoor(null); }
          }} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="text-xs">Back</span>
          </button>

          <div className="text-center">
            {songTitle ? (
              <>
                <p className="text-sm font-semibold text-white leading-none">{songTitle}</p>
                <p className="text-[10px] text-gray-600">{artistName}{genre ? ` · ${genre} · ${bpm} BPM` : ''}</p>
              </>
            ) : (
              <p className="text-xs text-gray-600">New Session</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {vocalUrl && phase !== 'done' && (
              <button onClick={exportSong} disabled={exporting}
                className="text-xs px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded-lg text-white flex items-center gap-1">
                {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                Export
              </button>
            )}
            <button onClick={reset} className="text-gray-700 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ MAIN CONTENT — fills remaining space ═══ */}
      <div className="flex-1 flex items-center justify-center overflow-auto">

      {/* ═══ DOOR SELECT ═══ */}
      {phase === 'doors' && (
        <div className="relative z-10 text-center max-w-2xl px-6">
          {/* Back to home */}
          <a href="/" className="absolute top-0 left-6 flex items-center gap-2 text-gray-400 hover:text-teal-400 transition-colors text-sm bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-teal-500/30">
            <ChevronRight className="w-4 h-4 rotate-180" /> Home
          </a>

          <h1 className="text-4xl font-bold mb-2 tracking-tight">
            Sound<span className="text-teal-400">Mint</span>
          </h1>
          <p className="text-gray-600 text-sm mb-12">What do you want to make?</p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'write' as Door, icon: PenTool, label: 'Write', desc: 'Start with lyrics or a melody', glow: 'hover:shadow-teal-500/10' },
              { id: 'record' as Door, icon: Mic, label: 'Record', desc: 'Step up to the mic', glow: 'hover:shadow-teal-500/10' },
              { id: 'build' as Door, icon: Grid3X3, label: 'Build', desc: 'Construct a beat from scratch', glow: 'hover:shadow-teal-500/10' },
            ].map(({ id, icon: Icon, label, desc, glow }) => (
              <button key={id} onClick={() => { setDoor(id); setPhase('setup'); }}
                className={`group p-8 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-teal-500/20 transition-all hover:scale-[1.02] ${glow} hover:shadow-2xl`}>
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-teal-500/20 transition-colors">
                  <Icon className="w-6 h-6 text-teal-400" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{label}</h3>
                <p className="text-xs text-gray-600">{desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SETUP ═══ */}
      {phase === 'setup' && (
        <div className="relative z-10 w-full max-w-md px-6">
          <button onClick={reset} className="absolute top-0 right-6 text-gray-700 hover:text-white"><X className="w-5 h-5" /></button>

          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
              {door === 'write' ? <PenTool className="w-5 h-5 text-teal-400" /> :
               door === 'record' ? <Mic className="w-5 h-5 text-teal-400" /> :
               <Grid3X3 className="w-5 h-5 text-teal-400" />}
            </div>
            <h2 className="text-xl font-bold">
              {door === 'write' ? 'Write a Song' : door === 'record' ? 'Record a Track' : 'Build a Beat'}
            </h2>
          </div>

          <div className="space-y-4">
            <input type="text" value={artistName} onChange={e => setArtistName(e.target.value)}
              placeholder="Artist name" autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-gray-700 focus:outline-none focus:border-teal-500/50 text-center text-lg" />

            <input type="text" value={songTitle} onChange={e => handleTitle(e.target.value)}
              placeholder="Song title"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-gray-700 focus:outline-none focus:border-teal-500/50 text-center text-lg" />

            {songTitle.length > 2 && (
              <div className="flex gap-2 justify-center">
                <span className="text-[10px] px-2 py-1 rounded-full bg-teal-500/10 text-teal-400">{genre}</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-teal-500/10 text-teal-400">{mood}</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-teal-500/10 text-teal-400">{bpm} BPM</span>
              </div>
            )}

            {door === 'write' && (
              <textarea value={lyrics} onChange={e => setLyrics(e.target.value)}
                placeholder="Write your lyrics here..."
                rows={6}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-teal-500/50 text-sm leading-relaxed" />
            )}

            <div className="flex gap-3">
            <button onClick={async () => {
              if (!artistName.trim() || !songTitle.trim()) return toast.error('Enter name and title');
              if (door === 'build') { window.location.href = '/studio'; return; }
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
              } catch { toast.error('Mic access needed to record'); return; }
              setPhase('booth');
              setTimeout(startBeat, 200);
            }}
              disabled={!artistName.trim() || !songTitle.trim()}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-30 text-white font-medium py-4 rounded-xl flex items-center justify-center gap-2 text-lg transition-all">
              <Zap className="w-5 h-5" /> Instant Beat
            </button>
            <button onClick={async () => {
              if (!artistName.trim() || !songTitle.trim()) return toast.error('Enter name and title');
              // Request mic early
              try {
                const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                s.getTracks().forEach(t => t.stop());
              } catch { toast.error('Mic access needed'); return; }
              // Generate AI beat
              setPhase('creating');
              try {
                const res = await fetch('/api/tracks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ genre, mood, prompt: `${genre} ${mood} ${bpm} BPM instrumental`, artist_name: artistName, ai_provider: 'musicgen' }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                // Poll for completion
                const poll = setInterval(async () => {
                  const check = await fetch(`/api/tracks/${data.id}`);
                  const track = await check.json();
                  if (track.status === 'ready' && track.audio_url) {
                    clearInterval(poll);
                    setBeatUrl(track.audio_url);
                    setPhase('booth');
                    toast.success('AI beat ready!');
                  } else if (track.status === 'failed') {
                    clearInterval(poll);
                    toast.error('Generation failed — using instant beat');
                    setPhase('booth');
                    setTimeout(startBeat, 200);
                  }
                }, 5000);
              } catch {
                toast.error('AI failed — using instant beat');
                setPhase('booth');
                setTimeout(startBeat, 200);
              }
            }}
              disabled={!artistName.trim() || !songTitle.trim()}
              className="flex-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-gray-300 font-medium py-4 rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all">
              <Wand2 className="w-4 h-4" /> AI Beat
            </button>
            </div>{/* close flex row */}

            {/* AI Full Song option */}
            <button onClick={async () => {
              if (!artistName.trim() || !songTitle.trim()) return toast.error('Enter name and title');
              setPhase('creating');
              try {
                // Generate full song with vocals via Suno-style prompt
                const prompt = lyrics
                  ? `${genre} ${mood} ${bpm} BPM song with vocals singing: ${lyrics.slice(0, 200)}`
                  : `${genre} ${mood} ${bpm} BPM song with vocals, catchy melody, about ${songTitle}`;
                const res = await fetch('/api/tracks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    genre, mood, prompt,
                    artist_name: artistName,
                    ai_provider: 'suno',
                    with_vocals: true,
                    lyrics: lyrics || undefined,
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  // Suno not available — fall back to MusicGen instrumental
                  toast.error('Full song AI not configured — generating instrumental');
                  const fallback = await fetch('/api/tracks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ genre, mood, prompt: `${genre} ${mood} ${bpm} BPM instrumental`, artist_name: artistName, ai_provider: 'musicgen' }),
                  });
                  const fbData = await fallback.json();
                  if (!fallback.ok) throw new Error(fbData.error);
                  // Poll fallback
                  const poll = setInterval(async () => {
                    const check = await fetch(`/api/tracks/${fbData.id}`);
                    const track = await check.json();
                    if (track.status === 'ready' && track.audio_url) { clearInterval(poll); setBeatUrl(track.audio_url); setPhase('booth'); toast.success('Beat ready'); }
                    else if (track.status === 'failed') { clearInterval(poll); setPhase('booth'); setTimeout(startBeat, 200); toast.error('Using instant beat'); }
                  }, 5000);
                  return;
                }
                // Poll for full song
                const poll = setInterval(async () => {
                  const check = await fetch(`/api/tracks/${data.id}`);
                  const track = await check.json();
                  if (track.status === 'ready' && track.audio_url) {
                    clearInterval(poll);
                    setVocalUrl(track.audio_url); // Full song goes to vocal slot
                    setPhase('mix'); // Skip booth — song is already complete
                    toast.success('Full song created!');
                  } else if (track.status === 'failed') {
                    clearInterval(poll);
                    toast.error('Full song failed — entering studio');
                    setPhase('booth');
                    setTimeout(startBeat, 200);
                  }
                }, 5000);
              } catch {
                toast.error('Failed — using instant beat');
                setPhase('booth');
                setTimeout(startBeat, 200);
              }
            }}
              disabled={!artistName.trim() || !songTitle.trim()}
              className="w-full bg-purple-600/20 hover:bg-purple-600/30 disabled:opacity-30 text-purple-300 font-medium py-3 rounded-xl flex items-center justify-center gap-2 border border-purple-500/20 transition-all text-sm">
              <Wand2 className="w-4 h-4" /> AI Full Song (vocals + beat)
              <span className="text-[9px] text-purple-500 ml-1">requires Suno API</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══ AI CREATING ═══ */}
      {phase === 'creating' && (
        <div className="relative z-10 text-center px-6">
          <div className="w-20 h-20 rounded-full bg-teal-500/10 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Creating Your Beat</h2>
          <p className="text-gray-500 text-sm mb-2">{genre} · {mood} · {bpm} BPM</p>
          <p className="text-gray-700 text-xs">AI is composing — this takes 2-3 minutes...</p>
          <button onClick={() => { setPhase('booth'); setTimeout(startBeat, 200); toast.success('Switched to instant beat'); }}
            className="mt-8 text-xs text-gray-600 hover:text-teal-400 transition-colors underline">
            Skip — use instant beat instead
          </button>
        </div>
      )}

      {/* ═══ THE BOOTH ═══ */}
      {phase === 'booth' && (
        <div className="relative z-10 w-full max-w-lg px-6 text-center">
          {/* AI beat audio element */}
          {beatUrl && <audio id="aiBeatAudio" src={beatUrl} loop />}

          {/* Song info */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">{songTitle}</h2>
            <p className="text-sm text-gray-600">{artistName}</p>
          </div>

          {/* Lyrics teleprompter (songwriter mode) */}
          {door === 'write' && lyrics && (
            <div className="mb-4 max-h-20 overflow-auto bg-white/[0.02] rounded-xl p-3 border border-white/5">
              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{lyrics}</p>
            </div>
          )}

          {/* Circular visualizer */}
          <div className="relative w-64 h-64 mx-auto mb-8">
            {/* Outer ring */}
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {vizData.map((v, i) => {
                const angle = (i / vizData.length) * Math.PI * 2 - Math.PI / 2;
                const innerR = 60;
                const outerR = innerR + v * 35;
                return (
                  <line key={i}
                    x1={100 + Math.cos(angle) * innerR}
                    y1={100 + Math.sin(angle) * innerR}
                    x2={100 + Math.cos(angle) * outerR}
                    y2={100 + Math.sin(angle) * outerR}
                    stroke={isRecording ? '#ef4444' : '#14b8a6'}
                    strokeWidth={2}
                    opacity={0.3 + v * 0.7}
                    strokeLinecap="round"
                  />
                );
              })}
              {/* Center circle */}
              <circle cx={100} cy={100} r={55} fill="none"
                stroke={isRecording ? '#ef444440' : '#14b8a620'} strokeWidth={1} />
              <circle cx={100} cy={100} r={30} fill="none"
                stroke={isRecording ? '#ef444420' : '#14b8a610'} strokeWidth={1} />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isRecording ? (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mb-2" />
                  <span className="text-2xl font-mono text-red-400 font-bold">{formatTime(recordingTime)}</span>
                  <span className="text-[10px] text-red-400/60 uppercase tracking-widest">Recording</span>
                </>
              ) : (
                <>
                  <Mic className="w-8 h-8 text-teal-400/40 mb-2" />
                  <span className="text-[10px] text-gray-600 uppercase tracking-widest">Ready</span>
                </>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {!isRecording ? (
              <>
                <button onClick={() => { if (isPlaying) stopBeat(); else startBeat(); }}
                  className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button onClick={startRecording}
                  className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-red-600/20">
                  <Mic className="w-8 h-8 text-white" />
                </button>
                <button onClick={() => { stopAll(); startBeat(); }}
                  className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                  title="New beat">
                  <RotateCcw className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <Square className="w-8 h-8 text-white" />
              </button>
            )}
          </div>

          {/* Vocal preset */}
          {!isRecording && (
            <div className="space-y-3">
              <div className="flex gap-1.5 justify-center">
                {Object.entries(VOCAL_PRESETS).map(([key, p]) => (
                  <button key={key} onClick={() => setVocalPreset(key)}
                    className={`text-[11px] px-3 py-1.5 rounded-full transition-all ${
                      vocalPreset === key ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-white/5 text-gray-600 border border-transparent hover:text-white'
                    }`}>{p.label}</button>
                ))}
              </div>
              <div className="flex gap-1.5 justify-center">
                {Object.entries(SPACE_PRESETS).map(([key, p]) => (
                  <button key={key} onClick={() => setSpacePreset(key)}
                    className={`text-[11px] px-3 py-1.5 rounded-full transition-all ${
                      spacePreset === key ? 'bg-white/10 text-white border border-white/20' : 'bg-white/5 text-gray-600 border border-transparent hover:text-white'
                    }`}>{p.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MIX ═══ */}
      {phase === 'mix' && (
        <div className="relative z-10 w-full max-w-lg px-6 text-center">
          {vocalUrl && <audio ref={vocalAudioRef} src={vocalUrl} />}

          <h2 className="text-3xl font-bold mb-1 tracking-tight">{songTitle}</h2>
          <p className="text-sm text-gray-600 mb-2">{artistName}</p>
          <div className="flex gap-2 justify-center mb-8">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">{genre}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">{bpm} BPM</span>
          </div>

          {/* Big play button */}
          <button onClick={isPlaying ? stopAll : playMix}
            className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 transition-all hover:scale-105 ${
              isPlaying
                ? 'bg-white/10 hover:bg-white/20 shadow-lg shadow-teal-500/10'
                : 'bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20'
            }`}>
            {isPlaying ? <Pause className="w-10 h-10 text-white" /> : <Play className="w-10 h-10 text-white ml-1" />}
          </button>

          {isPlaying && (
            <p className="text-xs text-teal-400/60 mb-6 animate-pulse">Playing your mix...</p>
          )}

          {/* Volume controls — larger, more touch-friendly */}
          <div className="space-y-5 mb-8 bg-white/[0.02] rounded-2xl border border-white/5 p-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Beat</span>
                <span className="text-sm text-gray-600">{beatVolume}%</span>
              </div>
              <input type="range" min={0} max={100} value={beatVolume}
                onChange={e => { const v = parseInt(e.target.value); setBeatVolume(v); beatPlayerRef.current?.setVolume(v / 100); }}
                className="w-full accent-teal-500 h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Vocals</span>
                <span className="text-sm text-gray-600">{vocalVolume}%</span>
              </div>
              <input type="range" min={0} max={100} value={vocalVolume}
                onChange={e => { const v = parseInt(e.target.value); setVocalVolume(v); if (vocalAudioRef.current) vocalAudioRef.current.volume = v / 100; }}
                className="w-full accent-teal-500 h-2" />
            </div>

            {/* Vocal preset in mix */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Vocal Sound</p>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {Object.entries(VOCAL_PRESETS).map(([key, p]) => (
                  <button key={key} onClick={() => setVocalPreset(key)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                      vocalPreset === key ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-white/5 text-gray-600 border border-transparent'
                    }`}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* Autotune */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Auto-Tune</p>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {Object.entries(AUTOTUNE_PRESETS).map(([key, p]) => (
                  <button key={key} onClick={() => setAutotunePreset(key)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                      autotunePreset === key
                        ? key === 'off' ? 'bg-white/10 text-white border border-white/20' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-white/5 text-gray-600 border border-transparent'
                    }`}>{p.label}</button>
                ))}
              </div>
              {autotunePreset !== 'off' && (
                <p className="text-[10px] text-gray-600 mt-1 text-center">{AUTOTUNE_PRESETS[autotunePreset]?.desc}</p>
              )}
            </div>
          </div>

          {/* Action buttons — clear hierarchy */}
          <div className="space-y-3">
            <button onClick={exportSong} disabled={exporting}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 text-lg transition-all">
              {exporting ? <><Loader2 className="w-5 h-5 animate-spin" /> Mastering...</> : <><Download className="w-5 h-5" /> Export Song</>}
            </button>

            <div className="flex gap-3">
              <button onClick={() => { stopAll(); setPhase('booth'); }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-400">
                Re-record
              </button>
              <button onClick={reset}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-400">
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DONE ═══ */}
      {phase === 'done' && (
        <div className="relative z-10 w-full max-w-md px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-teal-400" />
          </div>

          <h2 className="text-2xl font-bold mb-1">{songTitle}</h2>
          <p className="text-gray-500 text-sm mb-6">by {artistName}</p>

          <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5 mb-6 text-left">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-gray-600">Genre</span><span className="text-gray-300">{genre} · {mood}</span>
              <span className="text-gray-600">Tempo</span><span className="text-gray-300">{bpm} BPM</span>
              <span className="text-gray-600">Format</span><span className="text-gray-300">MP3 320kbps, Mastered</span>
              <span className="text-gray-600">Created</span><span className="text-gray-300">{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            {exportUrl && (
              <a href={exportUrl} download={`${artistName} - ${songTitle}.mp3`}
                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Download
              </a>
            )}
            <button onClick={reset}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300">
              New Session
            </button>
          </div>
        </div>
      )}
      </div>{/* close main content wrapper */}
    </div>
  );
}
