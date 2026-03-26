'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Play, Pause, Square, Download, Check, ChevronRight,
  PenTool, Radio, Grid3X3, Loader2, RotateCcw, Zap, X, Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAudioEngine, VOCAL_PRESETS, type VocalPreset } from '@/lib/audio-engine';
import { useSoundMintStore } from '@/lib/store';
import { saveProject } from '@/lib/project';
import { BeatPlayer, type BeatConfig } from '@/lib/beatFactory';
import LevelMeter from '@/components/LevelMeter';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Slider from '@/components/ui/Slider';

// ─── Types ───
type Door = null | 'write' | 'record' | 'build';
type Phase = 'doors' | 'setup' | 'creating' | 'booth' | 'mix' | 'done';

const AUTOTUNE_PRESETS: Record<string, { label: string; desc: string; speed: number; detune: number; chorusDepth: number }> = {
  off:     { label: 'Off',     desc: 'No pitch correction',            speed: 0,   detune: 0,  chorusDepth: 0 },
  subtle:  { label: 'Subtle',  desc: 'Light correction, natural feel', speed: 0.3, detune: 5,  chorusDepth: 0.1 },
  modern:  { label: 'Modern',  desc: 'Pop/R&B standard correction',    speed: 0.6, detune: 10, chorusDepth: 0.2 },
  hard:    { label: 'Hard',    desc: 'T-Pain / Future style snap',     speed: 1.0, detune: 15, chorusDepth: 0.3 },
  robot:   { label: 'Robot',   desc: 'Extreme effect, Daft Punk vibes', speed: 1.0, detune: 25, chorusDepth: 0.5 },
  harmony: { label: 'Harmony', desc: 'Adds a 3rd and 5th above',      speed: 0.5, detune: 0,  chorusDepth: 0.4 },
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

function formatTime(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function SessionPage() {
  // ─── Store (project data) ───
  const { project, newProject, updateProject } = useSoundMintStore();

  // ─── Local UI state ───
  const [door, setDoor] = useState<Door>(null);
  const [phase, setPhase] = useState<Phase>('doors');
  const [artistName, setArtistName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [beatVolume, setBeatVolume] = useState(70);
  const [vocalVolume, setVocalVolume] = useState(100);
  const [beatUrl, setBeatUrl] = useState<string | null>(null);
  const [vocalUrl, setVocalUrl] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [vizData, setVizData] = useState<number[]>(new Array(64).fill(0));
  const [lyrics, setLyrics] = useState('');
  const [vocalPreset, setVocalPreset] = useState('warm');
  const [autotunePreset, setAutotunePreset] = useState('off');
  const [spacePreset, setSpacePreset] = useState('room');

  // ─── Refs ───
  const beatPlayerRef = useRef<BeatPlayer | null>(null);
  const animRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived from store or local
  const genre = project?.genre || 'hip-hop';
  const mood = project?.mood || 'chill';
  const bpm = project?.bpm || 90;

  // Title change => auto detect + update store
  function handleTitle(t: string) {
    setSongTitle(t);
    if (t.length > 2) {
      const d = detectFromTitle(t);
      updateProject({ genre: d.genre, mood: d.mood, bpm: d.bpm });
    }
  }

  // Ensure project exists in store when entering setup
  function ensureProject() {
    if (!project) {
      newProject(songTitle || 'Untitled', artistName || 'Unknown');
    } else {
      updateProject({ title: songTitle, artist: artistName });
    }
  }

  // ─── Beat Control ───
  function startBeat() {
    if (beatUrl) {
      const el = document.getElementById('aiBeatAudio') as HTMLAudioElement | null;
      if (el) { el.volume = beatVolume / 100; el.currentTime = 0; el.play(); }
    } else {
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

  // ─── Recording (through AudioEngine) ───
  async function startRecording() {
    try {
      const engine = getAudioEngine();
      const preset = VOCAL_PRESETS[vocalPreset] || VOCAL_PRESETS.raw;
      const ok = await engine.startRecording(preset);
      if (!ok) { toast.error('Mic access denied'); return; }

      const vizTick = () => {
        const analyser = engine.getRecordAnalyser();
        if (analyser) {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          setVizData(Array.from(data).map(v => v / 255));
        }
        animRef.current = requestAnimationFrame(vizTick);
      };
      animRef.current = requestAnimationFrame(vizTick);

      startBeat();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { toast.error('Mic access denied'); }
  }

  async function stopRecording() {
    const engine = getAudioEngine();
    const audioBuf = await engine.stopRecording();
    stopBeat();
    setIsRecording(false);
    cancelAnimationFrame(animRef.current);
    setVizData(new Array(64).fill(0));
    if (timerRef.current) clearInterval(timerRef.current);

    if (!audioBuf) { toast.error('Recording too short'); return; }

    toast.success('Processing recording...');

    let file: File;
    try {
      const wavBuf = engine.encodeWav(audioBuf);
      file = new File([wavBuf], `vocal-${Date.now()}.wav`, { type: 'audio/wav' });
    } catch {
      toast.error('WAV conversion failed');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', `${songTitle} - Vocals`);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.audio_url) {
        setVocalUrl(data.audio_url);
        toast.success('Recording ready -- hit Play to listen');
        setPhase('mix');
      } else {
        toast.error('Upload failed -- try again');
      }
    } catch {
      toast.error('Upload failed');
    }
  }

  // ─── Mix Playback (through AudioEngine) ───
  function playMix() {
    const engine = getAudioEngine();

    if (beatUrl) {
      const el = document.getElementById('aiBeatAudio') as HTMLAudioElement | null;
      if (el) { el.volume = beatVolume / 100; el.currentTime = 0; el.play().catch(() => {}); }
    } else {
      if (!beatPlayerRef.current) {
        const keys = ['C','D','E','F','G','A'];
        beatPlayerRef.current = new BeatPlayer({ genre, mood, bpm, key: keys[Math.floor(Math.random() * keys.length)] });
      }
      beatPlayerRef.current.setVolume(beatVolume / 100);
      beatPlayerRef.current.start();
    }

    if (vocalUrl) {
      const preset = VOCAL_PRESETS[vocalPreset] || VOCAL_PRESETS.raw;
      engine.loadAudio('vocals', vocalUrl).then(ok => {
        if (ok) {
          engine.applyPreset('vocals', preset);
          engine.setTrackParam('vocals', 'volume', vocalVolume);
          engine.playTrack('vocals', 0, false);
        }
      });
    }

    setIsPlaying(true);
  }

  function stopAll() {
    const engine = getAudioEngine();
    engine.stopAll();
    beatPlayerRef.current?.stop();
    const aiBeat = document.getElementById('aiBeatAudio') as HTMLAudioElement | null;
    if (aiBeat) aiBeat.pause();
    setIsPlaying(false);
  }

  // ─── Export ───
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

  // ─── Save ───
  async function saveSession() {
    ensureProject();
    if (project) {
      updateProject({
        session: { door: door || 'record', vocalPreset, autotunePreset, spacePreset, lyrics },
      });
      try {
        await saveProject({ ...project, title: songTitle, artist: artistName });
        toast.success('Session saved');
      } catch { toast.error('Save failed'); }
    } else {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artistName, songTitle, genre, mood, bpm, beatUrl, vocalUrl, vocalPreset, autotunePreset, beatVolume, vocalVolume, lyrics, door }),
        });
        if (res.ok) toast.success('Session saved');
        else toast.error('Save failed');
      } catch { toast.error('Save failed'); }
    }
  }

  function reset() {
    stopAll();
    setDoor(null); setPhase('doors'); setVocalUrl(null); setExportUrl(null);
    setSongTitle(''); setRecordingTime(0); setLyrics('');
  }

  // ─── Cleanup ───
  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    beatPlayerRef.current?.destroy();
  }, []);

  // Get engine analysers for LevelMeter
  const engine = typeof window !== 'undefined' ? getAudioEngine() : null;
  const recordAnalyser = engine?.getRecordAnalyser() ?? null;

  // ─── Back navigation handler ───
  function goBack() {
    if (phase === 'setup') { setPhase('doors'); setDoor(null); }
    else if (phase === 'booth') { stopAll(); setPhase('setup'); }
    else if (phase === 'mix') { stopAll(); setPhase('booth'); }
    else if (phase === 'done') { setPhase('mix'); }
    else { setPhase('doors'); setDoor(null); }
  }

  // ═══ RENDER ═══
  return (
    <div className={`h-full flex flex-col relative overflow-hidden transition-colors duration-700 ${
      isRecording ? 'bg-[#1a0808]' : 'bg-transparent'
    }`}>
      {/* Recording pulse overlay */}
      {isRecording && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 animate-[pulse_2s_ease-in-out_infinite] bg-red-900/[0.06]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-red-500/40" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-red-500/40" />
        </div>
      )}

      {/* Ambient glow — subtle, behind content */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full transition-all duration-1000 ${
          isRecording ? 'bg-red-500/[0.04] scale-110' : 'bg-teal-500/[0.02] scale-100'
        } blur-[120px]`} />
      </div>

      {/* Global audio for AI beat */}
      {beatUrl && <audio id="aiBeatAudio" src={beatUrl} loop crossOrigin="anonymous" />}

      {/* ═══ TOP BAR — compact session header ═══ */}
      {phase !== 'doors' && (
        <div className="relative z-20 h-10 flex items-center justify-between px-4 border-b border-white/[0.04] flex-shrink-0 bg-black/20 backdrop-blur-sm">
          <button onClick={goBack} className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors">
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            <span className="text-xs">Back</span>
          </button>

          <div className="flex items-center gap-3">
            {songTitle && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/80">{songTitle}</span>
                {artistName && <span className="text-xs text-gray-600">{artistName}</span>}
                {genre && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-500">{genre} {bpm}</span>}
              </div>
            )}
            {!songTitle && <span className="text-xs text-gray-600">New Session</span>}
          </div>

          <div className="flex items-center gap-1.5">
            {songTitle && phase !== 'setup' && (
              <Button variant="ghost" size="sm" onClick={saveSession}>Save</Button>
            )}
            {vocalUrl && phase !== 'done' && (
              <Button size="sm" onClick={exportSong} loading={exporting} icon={<Download className="w-3 h-3" />}>
                Export
              </Button>
            )}
            <button onClick={reset} className="text-gray-700 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ MAIN CONTENT — fills workspace ═══ */}
      <div className="flex-1 relative z-10 overflow-auto">

        {/* ═══ DOOR SELECT — three large panels ═══ */}
        {phase === 'doors' && (
          <div className="h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white/90 tracking-tight">
                  Sound<span className="text-teal-400">Mint</span> Session
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">Choose your workflow</p>
              </div>
              <a href="/" className="flex items-center gap-1.5 text-gray-500 hover:text-teal-400 transition-colors text-xs px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-teal-500/20">
                <ChevronRight className="w-3 h-3 rotate-180" /> Home
              </a>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
              {([
                { id: 'write' as Door, icon: PenTool, label: 'Write', desc: 'Start with lyrics or a melody idea. AI helps shape it into a full track.', accent: 'teal' },
                { id: 'record' as Door, icon: Mic, label: 'Record', desc: 'Step into the booth. Beat plays, you record over it. Mix and export.', accent: 'teal' },
                { id: 'build' as Door, icon: Grid3X3, label: 'Build', desc: 'Construct a beat from scratch in the studio with drums, synths, and bass.', accent: 'teal' },
              ]).map(({ id, icon: Icon, label, desc }) => (
                <button key={id} onClick={() => { setDoor(id); setPhase('setup'); }}
                  className="group relative flex flex-col items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-teal-500/20 transition-all duration-300 overflow-hidden">
                  {/* Hover glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200px] h-[200px] rounded-full bg-teal-500/[0.06] blur-[80px]" />
                  </div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-2xl bg-teal-500/[0.08] flex items-center justify-center mb-5 group-hover:bg-teal-500/[0.14] transition-colors duration-300 group-hover:shadow-lg group-hover:shadow-teal-500/[0.08]">
                      <Icon className="w-9 h-9 text-teal-400/70 group-hover:text-teal-400 transition-colors" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-white/90">{label}</h3>
                    <p className="text-xs text-gray-600 max-w-[200px] leading-relaxed">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SETUP — session config ═══ */}
        {phase === 'setup' && (
          <div className="h-full flex">
            {/* Left panel — form */}
            <div className="flex-1 flex flex-col justify-center px-12 max-w-xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-teal-500/[0.08] flex items-center justify-center">
                  {door === 'write' ? <PenTool className="w-4.5 h-4.5 text-teal-400" /> :
                   door === 'record' ? <Mic className="w-4.5 h-4.5 text-teal-400" /> :
                   <Grid3X3 className="w-4.5 h-4.5 text-teal-400" />}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white/90">
                    {door === 'write' ? 'Write a Song' : door === 'record' ? 'Record a Track' : 'Build a Beat'}
                  </h2>
                  <p className="text-xs text-gray-600">Name your session to get started</p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  value={artistName}
                  onChange={e => setArtistName(e.target.value)}
                  placeholder="Artist name"
                  autoFocus
                  label="Artist"
                />

                <Input
                  value={songTitle}
                  onChange={e => handleTitle(e.target.value)}
                  placeholder="Song title — type a vibe and we detect the genre"
                  label="Title"
                />

                {songTitle.length > 2 && (
                  <div className="flex gap-2">
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-teal-500/[0.08] text-teal-400/80 border border-teal-500/10">{genre}</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-teal-500/[0.08] text-teal-400/80 border border-teal-500/10">{mood}</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-teal-500/[0.08] text-teal-400/80 border border-teal-500/10">{bpm} BPM</span>
                  </div>
                )}

                {door === 'write' && (
                  <div>
                    <label className="text-sm text-gray-300 mb-1.5 block">Lyrics</label>
                    <textarea value={lyrics} onChange={e => setLyrics(e.target.value)}
                      placeholder="Write your lyrics here..."
                      rows={6}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-teal-500/30 text-sm leading-relaxed resize-none" />
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button size="lg" className="flex-1" icon={<Zap className="w-4 h-4" />}
                    disabled={!artistName.trim() || !songTitle.trim()}
                    onClick={async () => {
                      if (!artistName.trim() || !songTitle.trim()) return toast.error('Enter name and title');
                      ensureProject();
                      if (door === 'build') { window.location.href = '/studio'; return; }
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach(t => t.stop());
                      } catch { toast.error('Mic access needed to record'); return; }
                      setPhase('booth');
                      setTimeout(startBeat, 200);
                    }}>
                    Instant Beat
                  </Button>
                  <Button variant="secondary" size="lg" className="flex-1" icon={<Wand2 className="w-4 h-4" />}
                    disabled={!artistName.trim() || !songTitle.trim()}
                    onClick={async () => {
                      if (!artistName.trim() || !songTitle.trim()) return toast.error('Enter name and title');
                      ensureProject();
                      try {
                        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                        s.getTracks().forEach(t => t.stop());
                      } catch { toast.error('Mic access needed'); return; }
                      setPhase('creating');
                      try {
                        const res = await fetch('/api/tracks', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ genre, mood, prompt: `${genre} ${mood} ${bpm} BPM instrumental`, artist_name: artistName, ai_provider: 'musicgen' }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
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
                            toast.error('Generation failed -- using instant beat');
                            setPhase('booth');
                            setTimeout(startBeat, 200);
                          }
                        }, 5000);
                      } catch {
                        toast.error('AI failed -- using instant beat');
                        setPhase('booth');
                        setTimeout(startBeat, 200);
                      }
                    }}>
                    AI Beat
                  </Button>
                </div>

                {/* AI Full Song option */}
                <button onClick={async () => {
                  if (!artistName.trim() || !songTitle.trim()) return toast.error('Enter name and title');
                  ensureProject();
                  setPhase('creating');
                  try {
                    const prompt = lyrics
                      ? `${genre} ${mood} ${bpm} BPM song with vocals singing: ${lyrics.slice(0, 200)}`
                      : `${genre} ${mood} ${bpm} BPM song with vocals, catchy melody, about ${songTitle}`;
                    const res = await fetch('/api/tracks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        genre, mood, prompt, artist_name: artistName,
                        ai_provider: 'suno', with_vocals: true, lyrics: lyrics || undefined,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      toast.error('Full song AI not configured -- generating instrumental');
                      const fallback = await fetch('/api/tracks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ genre, mood, prompt: `${genre} ${mood} ${bpm} BPM instrumental`, artist_name: artistName, ai_provider: 'musicgen' }),
                      });
                      const fbData = await fallback.json();
                      if (!fallback.ok) throw new Error(fbData.error);
                      const poll = setInterval(async () => {
                        const check = await fetch(`/api/tracks/${fbData.id}`);
                        const track = await check.json();
                        if (track.status === 'ready' && track.audio_url) { clearInterval(poll); setBeatUrl(track.audio_url); setPhase('booth'); toast.success('Beat ready'); }
                        else if (track.status === 'failed') { clearInterval(poll); setPhase('booth'); setTimeout(startBeat, 200); toast.error('Using instant beat'); }
                      }, 5000);
                      return;
                    }
                    const poll = setInterval(async () => {
                      const check = await fetch(`/api/tracks/${data.id}`);
                      const track = await check.json();
                      if (track.status === 'ready' && track.audio_url) {
                        clearInterval(poll);
                        setVocalUrl(track.audio_url);
                        setPhase('mix');
                        toast.success('Full song created!');
                      } else if (track.status === 'failed') {
                        clearInterval(poll);
                        toast.error('Full song failed -- entering studio');
                        setPhase('booth');
                        setTimeout(startBeat, 200);
                      }
                    }, 5000);
                  } catch {
                    toast.error('Failed -- using instant beat');
                    setPhase('booth');
                    setTimeout(startBeat, 200);
                  }
                }}
                  disabled={!artistName.trim() || !songTitle.trim()}
                  className="w-full bg-purple-500/[0.08] hover:bg-purple-500/[0.14] disabled:opacity-30 text-purple-300/80 font-medium py-3 rounded-xl flex items-center justify-center gap-2 border border-purple-500/10 transition-all text-sm">
                  <Wand2 className="w-4 h-4" /> AI Full Song
                  <span className="text-[9px] text-purple-500/60 ml-1">requires Suno API</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ AI CREATING ═══ */}
        {phase === 'creating' && (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-teal-500/[0.06] flex items-center justify-center mb-8 relative">
              <Loader2 className="w-12 h-12 text-teal-400/60 animate-spin" />
              <div className="absolute inset-0 rounded-full border border-teal-500/10 animate-ping" style={{ animationDuration: '3s' }} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white/90">Creating Your Beat</h2>
            <p className="text-gray-500 text-sm mb-1">{genre} / {mood} / {bpm} BPM</p>
            <p className="text-gray-700 text-xs">AI is composing -- this takes 2-3 minutes...</p>
            <button onClick={() => { setPhase('booth'); setTimeout(startBeat, 200); toast.success('Switched to instant beat'); }}
              className="mt-10 text-xs text-gray-600 hover:text-teal-400 transition-colors underline underline-offset-4">
              Skip -- use instant beat instead
            </button>
          </div>
        )}

        {/* ═══ THE BOOTH — fills workspace, visualizer dominant ═══ */}
        {phase === 'booth' && (
          <div className="h-full flex flex-col">
            {/* Lyrics teleprompter — fixed at top if writing */}
            {door === 'write' && lyrics && (
              <div className="flex-shrink-0 mx-6 mt-3 max-h-16 overflow-auto bg-white/[0.015] rounded-lg px-4 py-2 border border-white/[0.04]">
                <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-wrap">{lyrics}</p>
              </div>
            )}

            {/* Visualizer area — takes up ~60% */}
            <div className="flex-1 flex items-center justify-center min-h-0 px-6 py-4">
              <div className="flex items-center gap-6 h-full max-h-[500px]" style={{ aspectRatio: 'auto' }}>
                {/* Left VU meter */}
                <div className={`transition-opacity duration-300 flex-shrink-0 ${isRecording ? 'opacity-100' : 'opacity-20'}`}>
                  <LevelMeter analyser={recordAnalyser} height={300} width={28} showDB={true} />
                </div>

                {/* Circular visualizer — large */}
                <div className="relative flex-shrink-0" style={{ width: 'min(55vh, 400px)', height: 'min(55vh, 400px)' }}>
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {vizData.map((v, i) => {
                      const angle = (i / vizData.length) * Math.PI * 2 - Math.PI / 2;
                      const innerR = 55;
                      const outerR = innerR + v * 40;
                      return (
                        <line key={i}
                          x1={100 + Math.cos(angle) * innerR} y1={100 + Math.sin(angle) * innerR}
                          x2={100 + Math.cos(angle) * outerR} y2={100 + Math.sin(angle) * outerR}
                          stroke={isRecording ? '#ef4444' : '#14b8a6'}
                          strokeWidth={2.5} opacity={0.2 + v * 0.8} strokeLinecap="round"
                        />
                      );
                    })}
                    <circle cx={100} cy={100} r={50} fill="none" stroke={isRecording ? '#ef444430' : '#14b8a615'} strokeWidth={1} />
                    <circle cx={100} cy={100} r={25} fill="none" stroke={isRecording ? '#ef444418' : '#14b8a60a'} strokeWidth={0.5} />
                  </svg>
                  {/* Center info */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {isRecording ? (
                      <>
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mb-3" />
                        <span className="text-2xl font-mono text-red-400 font-bold tracking-wider">{formatTime(recordingTime)}</span>
                        <span className="text-[10px] text-red-400/50 uppercase tracking-[0.2em] mt-1">Recording</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-8 h-8 text-teal-400/30 mb-2" />
                        <span className="text-[10px] text-gray-600 uppercase tracking-[0.2em]">Ready</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right VU meter */}
                <div className={`transition-opacity duration-300 flex-shrink-0 ${isRecording ? 'opacity-100' : 'opacity-20'}`}>
                  <LevelMeter analyser={recordAnalyser} height={300} width={28} showDB={true} />
                </div>
              </div>
            </div>

            {/* ─── Bottom dock — controls + presets ─── */}
            <div className="flex-shrink-0 bg-black/40 backdrop-blur-md border-t border-white/[0.04] px-6 py-4">
              {/* Transport controls */}
              <div className="flex items-center justify-center gap-4 mb-4">
                {!isRecording ? (
                  <>
                    <button onClick={() => { if (isPlaying) stopBeat(); else startBeat(); }}
                      className="w-11 h-11 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition-all">
                      {isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 ml-0.5" />}
                    </button>
                    <button onClick={startRecording}
                      className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-red-600/20 ring-2 ring-red-500/20 ring-offset-2 ring-offset-transparent">
                      <Mic className="w-7 h-7 text-white" />
                    </button>
                    <button onClick={() => { stopAll(); startBeat(); }}
                      className="w-11 h-11 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition-all"
                      title="New beat">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-all border border-white/10">
                    <Square className="w-7 h-7 text-white" />
                  </button>
                )}
              </div>

              {/* Preset pills — vocal + space */}
              {!isRecording && (
                <div className="space-y-2">
                  <div className="flex gap-1.5 justify-center flex-wrap">
                    {Object.entries(VOCAL_PRESETS).map(([key, p]) => (
                      <button key={key} onClick={() => setVocalPreset(key)}
                        className={`text-[11px] px-3.5 py-1.5 rounded-full transition-all duration-200 ${
                          vocalPreset === key
                            ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25 shadow-sm shadow-teal-500/10'
                            : 'bg-white/[0.03] text-gray-600 border border-transparent hover:text-gray-400 hover:bg-white/[0.05]'
                        }`}>{p.name}</button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 justify-center">
                    {Object.entries(SPACE_PRESETS).map(([key, p]) => (
                      <button key={key} onClick={() => setSpacePreset(key)}
                        className={`text-[11px] px-3.5 py-1.5 rounded-full transition-all duration-200 ${
                          spacePreset === key
                            ? 'bg-white/[0.08] text-white/80 border border-white/15'
                            : 'bg-white/[0.03] text-gray-600 border border-transparent hover:text-gray-400 hover:bg-white/[0.05]'
                        }`}>{p.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ MIX — split layout ═══ */}
        {phase === 'mix' && (
          <div className="h-full flex">
            {/* Left — visualizer / playback */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/[0.04] px-8">
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-white/90 tracking-tight">{songTitle}</h2>
                <p className="text-xs text-gray-600 mt-1">{artistName}</p>
                <div className="flex gap-2 justify-center mt-3">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-gray-500">{genre}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-gray-500">{bpm} BPM</span>
                </div>
              </div>

              {/* Play button */}
              <button onClick={isPlaying ? stopAll : playMix}
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-300 hover:scale-105 ${
                  isPlaying
                    ? 'bg-white/[0.06] hover:bg-white/[0.10] shadow-lg shadow-teal-500/5 ring-1 ring-white/10'
                    : 'bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-600/20'
                }`}>
                {isPlaying ? <Pause className="w-8 h-8 text-white" /> : <Play className="w-8 h-8 text-white ml-1" />}
              </button>

              {isPlaying && (
                <p className="text-[10px] text-teal-400/50 animate-pulse tracking-widest uppercase">Playing</p>
              )}

              {/* Action buttons */}
              <div className="mt-8 w-full max-w-xs space-y-2">
                <Button size="md" className="w-full" onClick={exportSong} loading={exporting}
                  icon={exporting ? undefined : <Download className="w-4 h-4" />}>
                  {exporting ? 'Mastering...' : 'Export Song'}
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => { stopAll(); setPhase('booth'); }}>
                    Re-record
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1" onClick={reset}>
                    Start Over
                  </Button>
                </div>
              </div>
            </div>

            {/* Right — controls panel */}
            <div className="w-80 flex-shrink-0 p-6 overflow-auto">
              <h3 className="text-sm font-medium text-white/70 mb-5">Mix Controls</h3>

              {/* Volume faders */}
              <div className="space-y-5 mb-8">
                <Slider label="Beat" value={beatVolume} suffix="%" onChange={v => {
                  setBeatVolume(v);
                  beatPlayerRef.current?.setVolume(v / 100);
                }} />
                <Slider label="Vocals" value={vocalVolume} suffix="%" onChange={v => {
                  setVocalVolume(v);
                  getAudioEngine().setTrackParam('vocals', 'volume', v);
                }} />
              </div>

              {/* Vocal preset */}
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-2.5">Vocal Sound</p>
                <div className="flex gap-1.5 flex-wrap">
                  {Object.entries(VOCAL_PRESETS).map(([key, p]) => (
                    <button key={key} onClick={() => {
                      setVocalPreset(key);
                      getAudioEngine().applyPreset('vocals', p);
                    }}
                      className={`text-[11px] px-3 py-1.5 rounded-full transition-all duration-200 ${
                        vocalPreset === key
                          ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25 shadow-sm shadow-teal-500/10'
                          : 'bg-white/[0.03] text-gray-600 border border-transparent hover:text-gray-400'
                      }`}>{p.name}</button>
                  ))}
                </div>
              </div>

              {/* Autotune */}
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-2.5">Auto-Tune</p>
                <div className="flex gap-1.5 flex-wrap">
                  {Object.entries(AUTOTUNE_PRESETS).map(([key, p]) => (
                    <button key={key} onClick={() => setAutotunePreset(key)}
                      className={`text-[11px] px-3 py-1.5 rounded-full transition-all duration-200 ${
                        autotunePreset === key
                          ? key === 'off'
                            ? 'bg-white/[0.08] text-white/70 border border-white/15'
                            : 'bg-purple-500/15 text-purple-400 border border-purple-500/25 shadow-sm shadow-purple-500/10'
                          : 'bg-white/[0.03] text-gray-600 border border-transparent hover:text-gray-400'
                      }`}>{p.label}</button>
                  ))}
                </div>
                {autotunePreset !== 'off' && (
                  <p className="text-[10px] text-gray-600 mt-2">{AUTOTUNE_PRESETS[autotunePreset]?.desc}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ DONE — release card ═══ */}
        {phase === 'done' && (
          <div className="h-full flex items-center justify-center">
            <div className="w-full max-w-sm">
              {/* Release card */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
                {/* Card header — accent strip */}
                <div className="h-1 bg-gradient-to-r from-teal-500/40 via-teal-400/60 to-teal-500/40" />

                <div className="p-8">
                  <div className="w-12 h-12 rounded-full bg-teal-500/[0.08] flex items-center justify-center mx-auto mb-5">
                    <Check className="w-6 h-6 text-teal-400" />
                  </div>

                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-white/90 mb-1">{songTitle}</h2>
                    <p className="text-sm text-gray-500">by {artistName}</p>
                  </div>

                  <div className="rounded-xl bg-black/20 p-4 mb-6">
                    <div className="grid grid-cols-2 gap-y-2.5 text-sm">
                      <span className="text-gray-600 text-xs">Genre</span><span className="text-gray-400 text-xs">{genre} / {mood}</span>
                      <span className="text-gray-600 text-xs">Tempo</span><span className="text-gray-400 text-xs">{bpm} BPM</span>
                      <span className="text-gray-600 text-xs">Format</span><span className="text-gray-400 text-xs">MP3 320kbps, Mastered</span>
                      <span className="text-gray-600 text-xs">Date</span><span className="text-gray-400 text-xs">{new Date().toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {exportUrl && (
                      <a href={exportUrl} download={`${artistName} - ${songTitle}.mp3`}
                        className="w-full py-3 bg-teal-600 hover:bg-teal-500 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                        <Download className="w-4 h-4" /> Download
                      </a>
                    )}
                    <Button variant="secondary" size="md" className="w-full" onClick={reset}>
                      New Session
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
