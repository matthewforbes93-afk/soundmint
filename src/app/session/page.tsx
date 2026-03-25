'use client';

import { useState, useRef } from 'react';
import { Wand2, Play, Pause, Mic, CircleDot, Square, Download, Save, ChevronRight, Check, Music, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'setup' | 'generate' | 'preview' | 'record' | 'mix' | 'export';

const GENRES = ['lo-fi', 'hip-hop', 'rap', 'trap', 'pop', 'r&b', 'jazz', 'electronic', 'ambient', 'cinematic', 'afrobeat', 'latin'];
const MOODS = ['chill', 'energetic', 'dark', 'uplifting', 'romantic', 'aggressive', 'dreamy', 'epic'];

// Smart auto-detect genre/mood/bpm from keywords in song title
function autoDetect(title: string): { genre: string; mood: string; bpm: number } {
  const t = title.toLowerCase();
  // Genre detection
  const genreMap: Record<string, string[]> = {
    'trap': ['trap', 'drip', 'ice', 'gang', 'stack', 'plug'],
    'rap': ['bars', 'flow', 'spit', 'rap', 'freestyle', 'cypher'],
    'hip-hop': ['hood', 'street', 'block', 'hustle', 'grind', 'real'],
    'r&b': ['love', 'heart', 'baby', 'feel', 'touch', 'kiss', 'boo'],
    'pop': ['dance', 'party', 'fun', 'summer', 'happy', 'shine'],
    'lo-fi': ['chill', 'study', 'relax', 'rain', 'coffee', 'night', 'sleep', 'dream'],
    'electronic': ['rave', 'bass', 'drop', 'synth', 'techno', 'pulse'],
    'jazz': ['smooth', 'jazz', 'swing', 'groove', 'blue'],
    'cinematic': ['epic', 'hero', 'rise', 'battle', 'war', 'glory'],
    'afrobeat': ['afro', 'vibe', 'africa', 'tribal', 'rhythm'],
    'latin': ['fuego', 'caliente', 'sol', 'latin', 'reggaeton'],
    'ambient': ['space', 'float', 'cosmos', 'ethereal', 'void', 'horizon'],
  };
  let genre = 'hip-hop';
  for (const [g, keywords] of Object.entries(genreMap)) {
    if (keywords.some(k => t.includes(k))) { genre = g; break; }
  }

  // Mood detection
  const moodMap: Record<string, string[]> = {
    'aggressive': ['angry', 'rage', 'war', 'fight', 'kill', 'gang', 'hard'],
    'dark': ['dark', 'shadow', 'death', 'demon', 'night', 'void'],
    'uplifting': ['rise', 'glory', 'shine', 'hero', 'win', 'fly', 'free'],
    'romantic': ['love', 'heart', 'baby', 'kiss', 'forever', 'boo'],
    'energetic': ['party', 'dance', 'hype', 'turn', 'lit', 'go'],
    'chill': ['chill', 'relax', 'vibe', 'smooth', 'easy', 'cool'],
    'dreamy': ['dream', 'float', 'cloud', 'sky', 'star', 'moon'],
    'epic': ['epic', 'battle', 'kingdom', 'legend', 'throne'],
  };
  let mood = 'chill';
  for (const [m, keywords] of Object.entries(moodMap)) {
    if (keywords.some(k => t.includes(k))) { mood = m; break; }
  }

  // BPM by genre
  const bpmMap: Record<string, number> = {
    'trap': 140, 'rap': 130, 'hip-hop': 90, 'r&b': 75, 'pop': 120,
    'lo-fi': 80, 'electronic': 128, 'jazz': 100, 'cinematic': 95,
    'afrobeat': 110, 'latin': 100, 'ambient': 70,
  };

  return { genre, mood, bpm: bpmMap[genre] || 90 };
}

export default function SessionPage() {
  const [step, setStep] = useState<Step>('setup');
  const [artistName, setArtistName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [genre, setGenre] = useState('lo-fi');
  const [mood, setMood] = useState('chill');
  const [bpm, setBpm] = useState(90);
  const [generating, setGenerating] = useState(false);
  const [beatUrl, setBeatUrl] = useState<string | null>(null);
  const [beatTrackId, setBeatTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [vocalUrl, setVocalUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [beatVolume, setBeatVolume] = useState(70);
  const [vocalVolume, setVocalVolume] = useState(100);
  const [autoMode, setAutoMode] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const beatAudioRef = useRef<HTMLAudioElement>(null);
  const vocalAudioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const steps: { id: Step; label: string; num: number }[] = [
    { id: 'setup', label: 'Setup', num: 1 },
    { id: 'generate', label: 'Create Beat', num: 2 },
    { id: 'preview', label: 'Preview', num: 3 },
    { id: 'record', label: 'Record', num: 4 },
    { id: 'mix', label: 'Mix', num: 5 },
    { id: 'export', label: 'Export', num: 6 },
  ];

  const currentStepIdx = steps.findIndex(s => s.id === step);

  // Auto-detect when title changes
  function handleTitleChange(title: string) {
    setSongTitle(title);
    if (autoMode && title.length > 2) {
      const detected = autoDetect(title);
      setGenre(detected.genre);
      setMood(detected.mood);
      setBpm(detected.bpm);
    }
  }

  // Quick start — just enter name + title, everything else is automatic
  function quickStart() {
    if (!artistName.trim()) return toast.error('Enter your artist name');
    if (!songTitle.trim()) return toast.error('Enter a song title');
    generateBeat();
  }

  // --- Step 2: Generate beat ---
  async function generateBeat() {
    if (!artistName.trim() || !songTitle.trim()) return toast.error('Enter artist name and song title');
    setGenerating(true);
    setStep('generate');

    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre, mood, prompt: `${genre} ${mood} ${bpm} BPM instrumental beat`,
          artist_name: artistName, ai_provider: 'musicgen',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBeatTrackId(data.id);

      // Poll for completion
      const poll = setInterval(async () => {
        const check = await fetch(`/api/tracks/${data.id}`);
        const track = await check.json();
        if (track.status === 'ready' && track.audio_url) {
          clearInterval(poll);
          setBeatUrl(track.audio_url);
          setGenerating(false);
          setStep('preview');
          toast.success('Beat created!');
        } else if (track.status === 'failed') {
          clearInterval(poll);
          setGenerating(false);
          toast.error('Beat generation failed — try again');
          setStep('setup');
        }
      }, 5000);
    } catch (err) {
      setGenerating(false);
      toast.error(err instanceof Error ? err.message : 'Generation failed');
      setStep('setup');
    }
  }

  // --- Step 3: Preview ---
  function toggleBeatPlay() {
    if (!beatAudioRef.current || !beatUrl) return;
    if (isPlaying) {
      beatAudioRef.current.pause();
    } else {
      beatAudioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }

  // --- Step 4: Record vocals ---
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Convert to WAV
        try {
          const ctx = new AudioContext();
          const buf = await ctx.decodeAudioData(await webmBlob.arrayBuffer());
          const numCh = buf.numberOfChannels;
          const sr = buf.sampleRate;
          const len = buf.length * numCh * 2 + 44;
          const wav = new ArrayBuffer(len);
          const v = new DataView(wav);
          const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
          ws(0,'RIFF'); v.setUint32(4,len-8,true); ws(8,'WAVE'); ws(12,'fmt ');
          v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,numCh,true);
          v.setUint32(24,sr,true); v.setUint32(28,sr*numCh*2,true); v.setUint16(32,numCh*2,true);
          v.setUint16(34,16,true); ws(36,'data'); v.setUint32(40,len-44,true);
          let off = 44;
          for (let i = 0; i < buf.length; i++) {
            for (let ch = 0; ch < numCh; ch++) {
              const s = Math.max(-1, Math.min(1, buf.getChannelData(ch)[i]));
              v.setInt16(off, s * 0x7FFF, true); off += 2;
            }
          }
          const wavFile = new File([wav], `vocal-${Date.now()}.wav`, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append('file', wavFile);
          formData.append('title', `${songTitle} - Vocals`);
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok) {
            setVocalUrl(uploadData.audio_url);
            toast.success('Vocals recorded!');
            setStep('mix');
          }
          ctx.close();
        } catch {
          toast.error('Recording save failed');
        }
      };

      // Play beat while recording
      if (beatAudioRef.current) {
        beatAudioRef.current.currentTime = 0;
        beatAudioRef.current.play();
      }

      recorder.start(100);
      setIsRecording(true);
    } catch {
      toast.error('Microphone access denied');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (beatAudioRef.current) beatAudioRef.current.pause();
  }

  // --- Step 5: Mix (adjust volumes) ---
  function playMix() {
    if (beatAudioRef.current) {
      beatAudioRef.current.volume = beatVolume / 100;
      beatAudioRef.current.currentTime = 0;
      beatAudioRef.current.play();
    }
    if (vocalAudioRef.current) {
      vocalAudioRef.current.volume = vocalVolume / 100;
      vocalAudioRef.current.currentTime = 0;
      vocalAudioRef.current.play();
    }
    setIsPlaying(true);
  }

  function stopMix() {
    beatAudioRef.current?.pause();
    vocalAudioRef.current?.pause();
    setIsPlaying(false);
  }

  // --- Step 6: Export ---
  async function exportSong() {
    setExporting(true);
    try {
      const trackUrls = [];
      if (beatUrl) trackUrls.push({ url: beatUrl, name: 'Beat', volume: beatVolume - 80, pan: 0, mute: false });
      if (vocalUrl) trackUrls.push({ url: vocalUrl, name: 'Vocals', volume: vocalVolume - 80, pan: 0, mute: false });

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackUrls, format: 'mp3', master: true, title: songTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExportUrl(data.audio_url);
      toast.success('Song exported!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-teal-500';
  const chip = (active: boolean) => `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${active ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:border-white/10'}`;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Hidden audio elements */}
      {beatUrl && <audio ref={beatAudioRef} src={beatUrl} loop onEnded={() => setIsPlaying(false)} />}
      {vocalUrl && <audio ref={vocalAudioRef} src={vocalUrl} />}

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i < currentStepIdx ? 'bg-teal-500 text-white' :
              i === currentStepIdx ? 'bg-teal-500/20 text-teal-400 ring-2 ring-teal-500' :
              'bg-white/5 text-gray-600'
            }`}>
              {i < currentStepIdx ? <Check className="w-4 h-4" /> : s.num}
            </div>
            <span className={`text-xs ${i <= currentStepIdx ? 'text-white' : 'text-gray-600'}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${i < currentStepIdx ? 'bg-teal-500' : 'bg-white/10'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Setup */}
      {step === 'setup' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-1">New Session</h1>
          <p className="text-gray-400 text-sm mb-6">Enter your name and song title — we'll handle the rest.</p>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-300 mb-1.5 block">Artist Name</label>
              <input type="text" value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Your name or stage name" className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1.5 block">Song Title</label>
              <input type="text" value={songTitle} onChange={e => handleTitleChange(e.target.value)} placeholder="e.g., Midnight Hustle, Love in the Rain, Street Dreams..." className={inputClass} />
            </div>

            {/* Auto-detected preview */}
            {songTitle.length > 2 && (
              <div className="bg-teal-500/5 border border-teal-500/10 rounded-lg p-3">
                <p className="text-[10px] text-teal-400 font-medium mb-2">AUTO-DETECTED</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs px-2 py-1 rounded bg-teal-500/10 text-teal-300">{genre}</span>
                  <span className="text-xs px-2 py-1 rounded bg-teal-500/10 text-teal-300">{mood}</span>
                  <span className="text-xs px-2 py-1 rounded bg-teal-500/10 text-teal-300">{bpm} BPM</span>
                </div>
              </div>
            )}

            {/* Quick start button */}
            <button onClick={quickStart}
              disabled={!artistName.trim() || !songTitle.trim()}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-4 rounded-lg flex items-center justify-center gap-2 text-lg">
              <Wand2 className="w-5 h-5" /> Create My Beat <ChevronRight className="w-5 h-5" />
            </button>

            {/* Advanced options toggle */}
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2">
              {showAdvanced ? 'Hide options' : 'Customize genre, mood & BPM'}
            </button>

            {showAdvanced && (
              <div className="space-y-4 border border-white/5 rounded-lg p-4">
                <div>
                  <label className="text-sm text-gray-300 mb-1.5 block">Genre</label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map(g => <button key={g} onClick={() => { setGenre(g); setAutoMode(false); }} className={chip(genre === g)}>{g}</button>)}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1.5 block">Mood</label>
                  <div className="flex flex-wrap gap-2">
                    {MOODS.map(m => <button key={m} onClick={() => { setMood(m); setAutoMode(false); }} className={chip(mood === m)}>{m}</button>)}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1.5 block">BPM: {bpm}</label>
                  <input type="range" min={60} max={180} value={bpm} onChange={e => { setBpm(parseInt(e.target.value)); setAutoMode(false); }} className="w-full accent-teal-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === 'generate' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <Loader2 className="w-12 h-12 text-teal-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Creating Your Beat</h2>
          <p className="text-gray-400 text-sm">{genre} · {mood} · {bpm} BPM</p>
          <p className="text-gray-500 text-xs mt-4">This takes 2-3 minutes on first generation...</p>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <Music className="w-12 h-12 text-teal-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Your Beat is Ready</h2>
          <p className="text-gray-400 text-sm mb-6">{songTitle} · {genre} · {mood} · {bpm} BPM</p>

          <button onClick={toggleBeatPlay}
            className="w-16 h-16 bg-teal-600 hover:bg-teal-700 rounded-full flex items-center justify-center mx-auto mb-6">
            {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
          </button>

          <div className="flex gap-3">
            <button onClick={() => { setStep('setup'); setBeatUrl(null); }}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300">
              Regenerate
            </button>
            <button onClick={() => setStep('record')}
              className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm text-white font-medium flex items-center justify-center gap-2">
              Record Vocals <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Record */}
      {step === 'record' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${isRecording ? 'bg-red-500/20 animate-pulse ring-4 ring-red-500/30' : 'bg-white/5'}`}>
            <Mic className={`w-10 h-10 ${isRecording ? 'text-red-400' : 'text-gray-500'}`} />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            {isRecording ? 'Recording...' : 'Ready to Record'}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {isRecording ? 'The beat is playing — sing or rap over it' : 'Hit record to start. The beat will play while you record.'}
          </p>

          <div className="flex gap-3 justify-center mb-4">
            {!isRecording ? (
              <button onClick={startRecording}
                className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center">
                <CircleDot className="w-6 h-6 text-white" />
              </button>
            ) : (
              <button onClick={stopRecording}
                className="w-16 h-16 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center">
                <Square className="w-6 h-6 text-white" />
              </button>
            )}
          </div>

          {!isRecording && (
            <button onClick={() => setStep('preview')} className="text-xs text-gray-500 hover:text-white">
              Back to preview
            </button>
          )}
        </div>
      )}

      {/* Step 5: Mix */}
      {step === 'mix' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-2">Mix Your Track</h2>
          <p className="text-gray-400 text-sm mb-6">Adjust the balance between beat and vocals.</p>

          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400 w-16">Beat</span>
              <input type="range" min={0} max={100} value={beatVolume} onChange={e => setBeatVolume(parseInt(e.target.value))}
                className="flex-1 accent-teal-500" />
              <span className="text-sm text-gray-500 w-10">{beatVolume}%</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400 w-16">Vocals</span>
              <input type="range" min={0} max={100} value={vocalVolume} onChange={e => setVocalVolume(parseInt(e.target.value))}
                className="flex-1 accent-teal-500" />
              <span className="text-sm text-gray-500 w-10">{vocalVolume}%</span>
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            <button onClick={isPlaying ? stopMix : playMix}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white flex items-center justify-center gap-2">
              {isPlaying ? <><Pause className="w-4 h-4" /> Stop</> : <><Play className="w-4 h-4" /> Preview Mix</>}
            </button>
            <button onClick={() => setStep('record')}
              className="py-3 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-400">
              Re-record
            </button>
          </div>

          <button onClick={() => { stopMix(); setStep('export'); }}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Export Song <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 6: Export */}
      {step === 'export' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          {!exportUrl ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Export Your Song</h2>
              <p className="text-gray-400 text-sm mb-6">Mix and master to streaming-ready MP3.</p>

              <div className="bg-white/5 rounded-lg p-4 mb-6 text-left">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-500">Artist</span><span className="text-white">{artistName}</span>
                  <span className="text-gray-500">Title</span><span className="text-white">{songTitle}</span>
                  <span className="text-gray-500">Genre</span><span className="text-white">{genre}</span>
                  <span className="text-gray-500">BPM</span><span className="text-white">{bpm}</span>
                  <span className="text-gray-500">Created</span><span className="text-white">{new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <button onClick={exportSong} disabled={exporting}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2">
                {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Mixing & Mastering...</> : <><Save className="w-4 h-4" /> Export & Save</>}
              </button>
            </>
          ) : (
            <>
              <Check className="w-12 h-12 text-teal-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Song Complete!</h2>
              <p className="text-gray-400 text-sm mb-6">"{songTitle}" by {artistName} is ready.</p>

              <div className="bg-white/5 rounded-lg p-4 mb-6 text-left">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-500">Artist</span><span className="text-white">{artistName}</span>
                  <span className="text-gray-500">Title</span><span className="text-white">{songTitle}</span>
                  <span className="text-gray-500">Genre</span><span className="text-white">{genre} · {mood}</span>
                  <span className="text-gray-500">BPM</span><span className="text-white">{bpm}</span>
                  <span className="text-gray-500">Format</span><span className="text-white">MP3 320kbps, Mastered</span>
                  <span className="text-gray-500">Created</span><span className="text-white">{new Date().toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <a href={exportUrl} download={`${artistName} - ${songTitle}.mp3`}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm text-white font-medium flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Download
                </a>
                <button onClick={() => { setStep('setup'); setBeatUrl(null); setVocalUrl(null); setExportUrl(null); setSongTitle(''); }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300">
                  New Session
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
