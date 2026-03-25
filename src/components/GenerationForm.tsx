'use client';

import { useState, useEffect } from 'react';
import { GenerationRequest, Genre, Mood, DistributionPlatform } from '@/lib/types';
import { Wand2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const genres: Genre[] = ['lo-fi', 'ambient', 'jazz', 'classical', 'electronic', 'hip-hop', 'rap', 'trap', 'drill', 'pop', 'r&b', 'rock', 'latin', 'reggaeton', 'afrobeat', 'dancehall', 'country', 'gospel', 'soul', 'funk', 'meditation', 'cinematic'];
const moods: Mood[] = ['chill', 'energetic', 'melancholic', 'uplifting', 'dark', 'peaceful', 'romantic', 'epic', 'dreamy', 'aggressive'];
const platforms: { value: DistributionPlatform; label: string }[] = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'amazon_music', label: 'Amazon Music' },
  { value: 'youtube_music', label: 'YouTube Music' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'deezer', label: 'Deezer' },
  { value: 'tidal', label: 'Tidal' },
];
const providers = [
  { value: 'musicgen', label: 'MusicGen (Free - Instrumentals)' },
  { value: 'suno', label: 'Suno (Paid - Vocals + Full Songs)' },
  { value: 'stable_audio', label: 'Stable Audio (Paid - Instrumentals)' },
  { value: 'loudly', label: 'Loudly (Paid - API)' },
];

const tempos = [
  { value: 'slow', label: 'Slow', bpm: '70 BPM' },
  { value: 'medium', label: 'Medium', bpm: '95 BPM' },
  { value: 'fast', label: 'Fast', bpm: '125 BPM' },
  { value: 'very-fast', label: 'Very Fast', bpm: '160 BPM' },
];

const voiceTypes = [
  { value: 'none', label: 'Instrumental' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'duet', label: 'Duet' },
  { value: 'choir', label: 'Choir' },
];

const songStructures = [
  { value: 'freeform', label: 'Freeform' },
  { value: 'verse-chorus', label: 'Verse-Chorus' },
  { value: 'intro-build-drop', label: 'Build-Drop' },
  { value: 'loop', label: 'Loop' },
  { value: 'ambient-flow', label: 'Ambient Flow' },
];

const allInstruments = [
  'piano', 'guitar', 'bass', 'drums', 'synth', 'strings', 'saxophone',
  'trumpet', 'flute', 'violin', 'cello', 'organ', 'harp', 'bells',
  'percussion', '808s', 'vinyl crackle', 'pad', 'choir',
];

// Smart presets — auto-selects best options per genre
const genrePresets: Record<string, {
  mood: Mood; tempo: string; voice: string; structure: string; instruments: string[];
}> = {
  'lo-fi': { mood: 'chill', tempo: 'slow', voice: 'none', structure: 'loop', instruments: ['piano', 'drums', 'vinyl crackle', 'bass'] },
  'ambient': { mood: 'peaceful', tempo: 'slow', voice: 'none', structure: 'ambient-flow', instruments: ['pad', 'strings', 'bells'] },
  'jazz': { mood: 'chill', tempo: 'medium', voice: 'none', structure: 'freeform', instruments: ['piano', 'saxophone', 'bass', 'drums'] },
  'classical': { mood: 'epic', tempo: 'medium', voice: 'none', structure: 'freeform', instruments: ['violin', 'cello', 'piano', 'strings', 'flute'] },
  'electronic': { mood: 'energetic', tempo: 'fast', voice: 'none', structure: 'intro-build-drop', instruments: ['synth', 'drums', 'bass', 'pad'] },
  'hip-hop': { mood: 'chill', tempo: 'medium', voice: 'none', structure: 'verse-chorus', instruments: ['drums', 'bass', 'piano', '808s'] },
  'rap': { mood: 'aggressive', tempo: 'fast', voice: 'male', structure: 'verse-chorus', instruments: ['808s', 'drums', 'bass', 'synth'] },
  'trap': { mood: 'dark', tempo: 'fast', voice: 'none', structure: 'loop', instruments: ['808s', 'drums', 'synth', 'bells'] },
  'drill': { mood: 'aggressive', tempo: 'fast', voice: 'none', structure: 'loop', instruments: ['808s', 'drums', 'piano', 'strings'] },
  'pop': { mood: 'uplifting', tempo: 'medium', voice: 'female', structure: 'verse-chorus', instruments: ['synth', 'drums', 'guitar', 'bass'] },
  'r&b': { mood: 'romantic', tempo: 'slow', voice: 'female', structure: 'verse-chorus', instruments: ['piano', 'bass', 'drums', 'pad'] },
  'rock': { mood: 'energetic', tempo: 'fast', voice: 'male', structure: 'verse-chorus', instruments: ['guitar', 'drums', 'bass'] },
  'latin': { mood: 'energetic', tempo: 'fast', voice: 'male', structure: 'verse-chorus', instruments: ['guitar', 'percussion', 'bass', 'trumpet'] },
  'reggaeton': { mood: 'energetic', tempo: 'medium', voice: 'male', structure: 'loop', instruments: ['drums', 'bass', 'synth', 'percussion'] },
  'afrobeat': { mood: 'energetic', tempo: 'medium', voice: 'none', structure: 'loop', instruments: ['drums', 'percussion', 'guitar', 'bass'] },
  'dancehall': { mood: 'energetic', tempo: 'fast', voice: 'male', structure: 'verse-chorus', instruments: ['drums', 'bass', 'synth', 'percussion'] },
  'country': { mood: 'uplifting', tempo: 'medium', voice: 'male', structure: 'verse-chorus', instruments: ['guitar', 'drums', 'bass', 'violin'] },
  'gospel': { mood: 'uplifting', tempo: 'medium', voice: 'choir', structure: 'verse-chorus', instruments: ['piano', 'organ', 'drums', 'bass'] },
  'soul': { mood: 'romantic', tempo: 'slow', voice: 'female', structure: 'verse-chorus', instruments: ['piano', 'bass', 'drums', 'organ'] },
  'funk': { mood: 'energetic', tempo: 'medium', voice: 'male', structure: 'loop', instruments: ['bass', 'drums', 'guitar', 'synth'] },
  'meditation': { mood: 'peaceful', tempo: 'slow', voice: 'none', structure: 'ambient-flow', instruments: ['pad', 'bells', 'harp'] },
  'cinematic': { mood: 'epic', tempo: 'medium', voice: 'none', structure: 'freeform', instruments: ['strings', 'drums', 'piano', 'cello', 'percussion'] },
};

interface GenerationFormProps {
  onGenerated?: (trackId: string) => void;
}

export default function GenerationForm({ onGenerated }: GenerationFormProps) {
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'mp3' | 'wav'>('mp3');
  const [autoMaster, setAutoMaster] = useState(true);
  const [tempo, setTempo] = useState('medium');
  const [voiceType, setVoiceType] = useState('none');
  const [structure, setStructure] = useState('freeform');
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>(['piano', 'drums', 'bass']);
  const [customBpm, setCustomBpm] = useState<number | null>(null);
  const [form, setForm] = useState<GenerationRequest>({
    genre: 'lo-fi',
    mood: 'chill',
    prompt: '',
    duration: 180,
    with_vocals: false,
    lyrics: '',
    artist_name: '',
    auto_publish: false,
    platforms: [],
    ai_provider: 'musicgen',
  });

  // Auto-select best options when genre changes
  useEffect(() => {
    const preset = genrePresets[form.genre];
    if (preset) {
      setForm(prev => ({ ...prev, mood: preset.mood }));
      setTempo(preset.tempo);
      setVoiceType(preset.voice);
      setStructure(preset.structure);
      setSelectedInstruments([...preset.instruments]);
    }
  }, [form.genre]);

  function buildFullPrompt(): string {
    const parts: string[] = [];
    parts.push(`${form.genre} ${form.mood}`);
    const tempoInfo = tempos.find(t => t.value === tempo);
    parts.push(customBpm ? `${customBpm} BPM` : tempoInfo?.bpm || '95 BPM');
    if (voiceType === 'male') parts.push('male vocals, deep voice');
    else if (voiceType === 'female') parts.push('female vocals, smooth voice');
    else if (voiceType === 'duet') parts.push('male and female duet vocals');
    else if (voiceType === 'choir') parts.push('choir vocals, group harmonies');
    else parts.push('instrumental, no vocals');
    if (structure === 'verse-chorus') parts.push('verse chorus structure');
    else if (structure === 'intro-build-drop') parts.push('intro buildup drop');
    else if (structure === 'loop') parts.push('looping beat, seamless');
    else if (structure === 'ambient-flow') parts.push('flowing ambient');
    if (selectedInstruments.length > 0) parts.push(selectedInstruments.join(', '));
    if (form.prompt.trim()) parts.push(form.prompt.trim());
    return parts.join(', ');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.artist_name.trim()) return toast.error('Enter an artist name');
    setLoading(true);
    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, prompt: buildFullPrompt(), with_vocals: voiceType !== 'none' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Track generated!');
      onGenerated?.(data.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  function toggleInstrument(inst: string) {
    setSelectedInstruments(prev => prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]);
  }

  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';
  const chip = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${active ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Step 1: Essentials */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Genre</label>
          <select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value as Genre })} className={inputClass}>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Mood</label>
          <select value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value as Mood })} className={inputClass}>
            {moods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Artist Name</label>
        <input type="text" value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} placeholder="e.g., Luna Waves" className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Describe Your Track (optional)</label>
        <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="e.g., late night vibes, summer road trip, hard-hitting street anthem..." rows={2} className={inputClass} />
      </div>

      {/* Auto-selected preview */}
      <div className="bg-gray-800/50 rounded-lg p-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500">Auto-selected:</span>
        <span className="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded">{tempos.find(t => t.value === tempo)?.label}</span>
        <span className="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded">{voiceTypes.find(v => v.value === voiceType)?.label}</span>
        <span className="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded">{songStructures.find(s => s.value === structure)?.label}</span>
        {selectedInstruments.slice(0, 4).map(i => (
          <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{i}</span>
        ))}
        {selectedInstruments.length > 4 && <span className="text-xs text-gray-500">+{selectedInstruments.length - 4}</span>}
      </div>

      {/* Customize toggle */}
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white py-2 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showAdvanced ? 'Hide' : 'Customize'} Tempo, Voice, Structure & Instruments
      </button>

      {/* Advanced options (hidden by default) */}
      {showAdvanced && (
        <div className="space-y-4 border border-gray-800 rounded-xl p-4">
          {/* Tempo */}
          <div>
            <label className={labelClass}>Tempo</label>
            <div className="flex gap-2 mb-2">
              {tempos.map((t) => (
                <button key={t.value} type="button" onClick={() => { setTempo(t.value); setCustomBpm(null); }} className={chip(tempo === t.value && !customBpm)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Custom:</span>
              <input type="number" min={40} max={240} value={customBpm || ''} onChange={(e) => setCustomBpm(e.target.value ? parseInt(e.target.value) : null)} placeholder="BPM" className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
          </div>

          {/* Voice */}
          <div>
            <label className={labelClass}>Voice</label>
            <div className="flex gap-2">
              {voiceTypes.map((v) => (
                <button key={v.value} type="button" onClick={() => setVoiceType(v.value)} className={chip(voiceType === v.value)}>
                  {v.label}
                </button>
              ))}
            </div>
            {voiceType !== 'none' && form.ai_provider === 'musicgen' && (
              <p className="text-xs text-yellow-400 mt-2">MusicGen is instrumental only. Vocals are added to the prompt for paid providers.</p>
            )}
          </div>

          {/* Structure */}
          <div>
            <label className={labelClass}>Structure</label>
            <div className="flex flex-wrap gap-2">
              {songStructures.map((s) => (
                <button key={s.value} type="button" onClick={() => setStructure(s.value)} className={chip(structure === s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Instruments */}
          <div>
            <label className={labelClass}>Instruments ({selectedInstruments.length})</label>
            <div className="flex flex-wrap gap-2">
              {allInstruments.map((inst) => (
                <button key={inst} type="button" onClick={() => toggleInstrument(inst)} className={chip(selectedInstruments.includes(inst))}>
                  {inst}
                </button>
              ))}
            </div>
          </div>

          {/* Vocals: Lyrics */}
          {voiceType !== 'none' && (
            <div>
              <label className={labelClass}>Lyrics (optional)</label>
              <textarea value={form.lyrics} onChange={(e) => setForm({ ...form, lyrics: e.target.value })} placeholder="Write lyrics or leave blank for AI..." rows={3} className={inputClass} />
            </div>
          )}

          {/* Provider, Format, Mastering */}
          <div>
            <label className={labelClass}>AI Provider</label>
            <select value={form.ai_provider} onChange={(e) => setForm({ ...form, ai_provider: e.target.value as GenerationRequest['ai_provider'] })} className={inputClass}>
              {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Format</label>
              <div className="flex gap-2">
                {(['mp3', 'wav'] as const).map((fmt) => (
                  <button key={fmt} type="button" onClick={() => setOutputFormat(fmt)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${outputFormat === fmt ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Master</label>
              <div className="flex items-center gap-3 mt-1">
                <button type="button" onClick={() => setAutoMaster(!autoMaster)} className={`relative w-11 h-6 rounded-full transition-colors ${autoMaster ? 'bg-purple-600' : 'bg-gray-700'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoMaster ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-xs text-gray-400">-14 LUFS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-publish */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setForm({ ...form, auto_publish: !form.auto_publish })} className={`relative w-11 h-6 rounded-full transition-colors ${form.auto_publish ? 'bg-purple-600' : 'bg-gray-700'}`}>
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.auto_publish ? 'translate-x-5' : ''}`} />
        </button>
        <span className="text-sm text-gray-300">Auto-publish after generation</span>
      </div>

      {form.auto_publish && (
        <div className="grid grid-cols-2 gap-2">
          {platforms.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.platforms?.includes(value) || false}
                onChange={(e) => { const sel = form.platforms || []; setForm({ ...form, platforms: e.target.checked ? [...sel, value] : sel.filter(p => p !== value) }); }}
                className="rounded bg-gray-800 border-gray-700 text-purple-500 focus:ring-purple-500" />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* Submit */}
      <button type="submit" disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating (~2-3 min)...</> : <><Wand2 className="w-4 h-4" /> Generate Track</>}
      </button>
    </form>
  );
}
