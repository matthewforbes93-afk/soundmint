'use client';

import { useState } from 'react';
import { GenerationRequest, Genre, Mood, DistributionPlatform } from '@/lib/types';
import { Wand2, Loader2 } from 'lucide-react';
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
  { value: 'slow', label: 'Slow (60-80 BPM)', bpm: '70 BPM' },
  { value: 'medium', label: 'Medium (80-110 BPM)', bpm: '95 BPM' },
  { value: 'fast', label: 'Fast (110-140 BPM)', bpm: '125 BPM' },
  { value: 'very-fast', label: 'Very Fast (140-180 BPM)', bpm: '160 BPM' },
];

const voiceTypes = [
  { value: 'none', label: 'No Vocals (Instrumental)' },
  { value: 'male', label: 'Male Vocals' },
  { value: 'female', label: 'Female Vocals' },
  { value: 'duet', label: 'Duet (Male + Female)' },
  { value: 'choir', label: 'Choir / Group' },
];

const songStructures = [
  { value: 'freeform', label: 'Freeform (AI decides)' },
  { value: 'verse-chorus', label: 'Verse → Chorus → Verse → Chorus' },
  { value: 'intro-build-drop', label: 'Intro → Build → Drop (EDM)' },
  { value: 'loop', label: 'Looping Beat (for playlists)' },
  { value: 'ambient-flow', label: 'Ambient Flow (no structure)' },
];

const instruments = [
  'piano', 'guitar', 'bass', 'drums', 'synth', 'strings', 'saxophone',
  'trumpet', 'flute', 'violin', 'cello', 'organ', 'harp', 'bells',
  'percussion', '808s', 'vinyl crackle', 'pad', 'choir',
];

interface GenerationFormProps {
  onGenerated?: (trackId: string) => void;
}

export default function GenerationForm({ onGenerated }: GenerationFormProps) {
  const [loading, setLoading] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'mp3' | 'wav'>('mp3');
  const [autoMaster, setAutoMaster] = useState(true);
  const [tempo, setTempo] = useState('medium');
  const [voiceType, setVoiceType] = useState('none');
  const [structure, setStructure] = useState('freeform');
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
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

  function buildFullPrompt(): string {
    const parts: string[] = [];

    // Genre & mood
    parts.push(`${form.genre} ${form.mood}`);

    // Tempo
    const tempoInfo = tempos.find(t => t.value === tempo);
    if (customBpm) {
      parts.push(`${customBpm} BPM`);
    } else if (tempoInfo) {
      parts.push(tempoInfo.bpm);
    }

    // Voice
    if (voiceType === 'male') parts.push('male vocals, deep voice');
    else if (voiceType === 'female') parts.push('female vocals, smooth voice');
    else if (voiceType === 'duet') parts.push('male and female duet vocals');
    else if (voiceType === 'choir') parts.push('choir vocals, group harmonies');
    else parts.push('instrumental, no vocals');

    // Structure
    if (structure === 'verse-chorus') parts.push('verse chorus verse chorus structure');
    else if (structure === 'intro-build-drop') parts.push('intro buildup drop breakdown');
    else if (structure === 'loop') parts.push('looping repetitive beat, seamless loop');
    else if (structure === 'ambient-flow') parts.push('flowing ambient, no distinct sections');

    // Instruments
    if (selectedInstruments.length > 0) {
      parts.push(selectedInstruments.join(', '));
    }

    // User prompt
    if (form.prompt.trim()) {
      parts.push(form.prompt.trim());
    }

    return parts.join(', ');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.artist_name.trim()) return toast.error('Enter an artist name');

    const fullPrompt = buildFullPrompt();
    if (!fullPrompt.trim()) return toast.error('Add some details about the track');

    setLoading(true);
    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          prompt: fullPrompt,
          with_vocals: voiceType !== 'none',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Track generation started!');
      onGenerated?.(data.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  function toggleInstrument(inst: string) {
    setSelectedInstruments(prev =>
      prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]
    );
  }

  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';
  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
      active ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Genre & Mood */}
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

      {/* Tempo / Rhythm */}
      <div>
        <label className={labelClass}>Tempo / Rhythm</label>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {tempos.map((t) => (
            <button key={t.value} type="button" onClick={() => { setTempo(t.value); setCustomBpm(null); }}
              className={chipClass(tempo === t.value && !customBpm)}>
              {t.label.split('(')[0].trim()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Custom BPM:</span>
          <input
            type="number"
            min={40}
            max={240}
            value={customBpm || ''}
            onChange={(e) => setCustomBpm(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="e.g. 128"
            className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Voice Type */}
      <div>
        <label className={labelClass}>Voice</label>
        <div className="grid grid-cols-5 gap-2">
          {voiceTypes.map((v) => (
            <button key={v.value} type="button" onClick={() => setVoiceType(v.value)}
              className={chipClass(voiceType === v.value)}>
              {v.label.split('(')[0].trim()}
            </button>
          ))}
        </div>
        {voiceType !== 'none' && form.ai_provider === 'musicgen' && (
          <p className="text-xs text-yellow-400 mt-2">Note: MusicGen is instrumental only. Switch to Suno for vocals.</p>
        )}
      </div>

      {/* Song Structure */}
      <div>
        <label className={labelClass}>Song Structure</label>
        <div className="grid grid-cols-3 gap-2">
          {songStructures.map((s) => (
            <button key={s.value} type="button" onClick={() => setStructure(s.value)}
              className={chipClass(structure === s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Instruments */}
      <div>
        <label className={labelClass}>Instruments {selectedInstruments.length > 0 && `(${selectedInstruments.length})`}</label>
        <div className="flex flex-wrap gap-2">
          {instruments.map((inst) => (
            <button key={inst} type="button" onClick={() => toggleInstrument(inst)}
              className={chipClass(selectedInstruments.includes(inst))}>
              {inst}
            </button>
          ))}
        </div>
      </div>

      {/* Artist Name & Prompt */}
      <div>
        <label className={labelClass}>Artist Name</label>
        <input type="text" value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} placeholder="e.g., Luna Waves" className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Additional Description (optional)</label>
        <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="Add any extra details — vibe, story, reference tracks..." rows={2} className={inputClass} />
      </div>

      {/* Vocals: Lyrics */}
      {voiceType !== 'none' && (
        <div>
          <label className={labelClass}>Lyrics (optional — leave blank for AI-generated)</label>
          <textarea value={form.lyrics} onChange={(e) => setForm({ ...form, lyrics: e.target.value })} placeholder="Write your lyrics here..." rows={4} className={inputClass} />
        </div>
      )}

      {/* AI Provider */}
      <div>
        <label className={labelClass}>AI Provider</label>
        <select value={form.ai_provider} onChange={(e) => setForm({ ...form, ai_provider: e.target.value as GenerationRequest['ai_provider'] })} className={inputClass}>
          {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* Duration */}
      <div>
        <label className={labelClass}>Duration: {form.duration}s ({Math.floor((form.duration || 180) / 60)}:{String((form.duration || 180) % 60).padStart(2, '0')})</label>
        <input type="range" min={30} max={480} step={30} value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })} className="w-full accent-purple-500" />
      </div>

      {/* Output Format & Mastering */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Output Format</label>
          <div className="flex gap-2">
            {(['mp3', 'wav'] as const).map((fmt) => (
              <button key={fmt} type="button" onClick={() => setOutputFormat(fmt)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  outputFormat === fmt ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Auto-Master</label>
          <div className="flex items-center gap-3 mt-1">
            <button type="button" onClick={() => setAutoMaster(!autoMaster)}
              className={`relative w-11 h-6 rounded-full transition-colors ${autoMaster ? 'bg-purple-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoMaster ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-xs text-gray-400">-14 LUFS (Spotify standard)</span>
          </div>
        </div>
      </div>

      {/* Auto-publish */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setForm({ ...form, auto_publish: !form.auto_publish })}
          className={`relative w-11 h-6 rounded-full transition-colors ${form.auto_publish ? 'bg-purple-600' : 'bg-gray-700'}`}>
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.auto_publish ? 'translate-x-5' : ''}`} />
        </button>
        <span className="text-sm text-gray-300">Auto-publish after generation</span>
      </div>

      {form.auto_publish && (
        <div>
          <label className={labelClass}>Platforms</label>
          <div className="grid grid-cols-2 gap-2">
            {platforms.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={form.platforms?.includes(value) || false}
                  onChange={(e) => {
                    const selected = form.platforms || [];
                    setForm({ ...form, platforms: e.target.checked ? [...selected, value] : selected.filter((p) => p !== value) });
                  }}
                  className="rounded bg-gray-800 border-gray-700 text-purple-500 focus:ring-purple-500" />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Preview */}
      <div className="bg-gray-800/50 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">AI Prompt Preview:</p>
        <p className="text-xs text-gray-300 italic">{buildFullPrompt() || 'Select options above...'}</p>
      </div>

      {/* Submit */}
      <button type="submit" disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating (~2-3 min)...</>
        ) : (
          <><Wand2 className="w-4 h-4" /> Generate Track</>
        )}
      </button>
    </form>
  );
}
