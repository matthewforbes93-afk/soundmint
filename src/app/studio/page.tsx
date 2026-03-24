'use client';

import { useState, useRef, useEffect } from 'react';
import { Sliders, Upload, Play, Pause, Download, Loader2, Music, Disc3, Save, History } from 'lucide-react';
import toast from 'react-hot-toast';
import StemChannel, { StemChannelConfig, DEFAULT_EFFECTS } from '@/components/StemChannel';
import AnalysisPanel from '@/components/AnalysisPanel';

const DEFAULT_STEMS: StemChannelConfig[] = [
  { name: 'drums', url: null, data: null, format: 'wav', volume: 0, pan: 0, mute: false, solo: false, effects: { ...DEFAULT_EFFECTS }, color: 'bg-red-500' },
  { name: 'bass', url: null, data: null, format: 'wav', volume: 0, pan: 0, mute: false, solo: false, effects: { ...DEFAULT_EFFECTS }, color: 'bg-blue-500' },
  { name: 'vocals', url: null, data: null, format: 'wav', volume: 0, pan: 0, mute: false, solo: false, effects: { ...DEFAULT_EFFECTS }, color: 'bg-green-500' },
  { name: 'other', url: null, data: null, format: 'wav', volume: 0, pan: 0, mute: false, solo: false, effects: { ...DEFAULT_EFFECTS }, color: 'bg-purple-500' },
];

interface MixVersion {
  id: string;
  name: string;
  mix_settings: Record<string, unknown>;
  audio_url: string | null;
  created_at: string;
}

export default function StudioPage() {
  const [stems, setStems] = useState<StemChannelConfig[]>(DEFAULT_STEMS);
  const [separating, setSeparating] = useState(false);
  const [mixing, setMixing] = useState(false);
  const [mixUrl, setMixUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackId, setTrackId] = useState('');
  const [versions, setVersions] = useState<MixVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [sourceAudioUrl, setSourceAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load versions when trackId changes
  useEffect(() => {
    if (trackId) loadVersions();
  }, [trackId]);

  async function loadVersions() {
    if (!trackId) return;
    try {
      const res = await fetch(`/api/versions?track_id=${trackId}`);
      const data = await res.json();
      if (Array.isArray(data)) setVersions(data);
    } catch { /* ignore */ }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Create object URL for analysis
    setSourceAudioUrl(URL.createObjectURL(file));
    await separateAudio(file);
  }

  async function handleTrackSeparate() {
    if (!trackId.trim()) return toast.error('Enter a track ID');
    // Get track audio URL for analysis
    try {
      const res = await fetch(`/api/tracks/${trackId}`);
      const track = await res.json();
      if (track.audio_url) setSourceAudioUrl(track.audio_url);
    } catch { /* ignore */ }
    await separateAudio(null, trackId);
  }

  async function separateAudio(file: File | null, id?: string) {
    setSeparating(true);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (id) formData.append('track_id', id);
      formData.append('format', 'wav');

      const res = await fetch('/api/separate', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStems(prev => prev.map(stem => ({
        ...stem,
        url: data.stems[stem.name] || null,
      })));

      toast.success(`Separated into ${data.stem_names.length} stems!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Separation failed');
    } finally {
      setSeparating(false);
    }
  }

  function updateStem(index: number, updates: Partial<StemChannelConfig>) {
    setStems(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }

  async function handleMix() {
    const activeStemData: Record<string, unknown> = {};
    const hasSolo = stems.some(s => s.solo);

    for (const stem of stems) {
      if (!stem.url) continue;
      const isActive = hasSolo ? stem.solo : !stem.mute;
      if (!isActive) continue;

      const res = await fetch(stem.url);
      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      activeStemData[stem.name] = {
        data: b64,
        format: stem.format,
        volume: stem.volume,
        pan: stem.pan,
        reverb: stem.effects.reverb.amount,
        mute: false,
        eq: stem.effects.eq,
        compression: stem.effects.compression,
        delay: stem.effects.delay,
        chorus: stem.effects.chorus,
      };
    }

    if (Object.keys(activeStemData).length === 0) {
      return toast.error('No active stems to mix');
    }

    setMixing(true);
    try {
      const res = await fetch('/api/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stems: activeStemData, format: 'mp3', master: true, track_id: trackId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMixUrl(data.audio_url);
      toast.success('Mix exported!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mix failed');
    } finally {
      setMixing(false);
    }
  }

  async function saveVersion() {
    if (!trackId) return toast.error('Need a track ID to save versions');
    try {
      const mixSettings = stems.map(s => ({
        name: s.name,
        volume: s.volume,
        pan: s.pan,
        mute: s.mute,
        solo: s.solo,
        effects: s.effects,
      }));

      const res = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: trackId,
          name: `Mix v${versions.length + 1}`,
          mix_settings: mixSettings,
          audio_url: mixUrl,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Version saved!');
      loadVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  function restoreVersion(version: MixVersion) {
    const settings = version.mix_settings as unknown as Array<{
      name: string; volume: number; pan: number; mute: boolean; solo: boolean;
      effects: StemChannelConfig['effects'];
    }>;
    if (Array.isArray(settings)) {
      setStems(prev => prev.map(stem => {
        const saved = settings.find(s => s.name === stem.name);
        return saved ? { ...stem, ...saved } : stem;
      }));
    }
    if (version.audio_url) setMixUrl(version.audio_url);
    toast.success(`Restored: ${version.name}`);
  }

  function togglePlay() {
    if (!mixUrl || !audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  }

  const hasStemData = stems.some(s => s.url);
  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Sliders className="w-6 h-6 text-purple-500" />
          Studio
        </h1>
        <p className="text-gray-400 text-sm mt-1">Separate, mix, master — full production suite</p>
      </div>

      {/* Upload / Separate */}
      {!hasStemData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Load Audio</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Upload an audio file</p>
              <input ref={fileRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={separating}
                className="w-full flex items-center justify-center gap-2 py-12 border-2 border-dashed border-gray-700 rounded-xl hover:border-purple-500 transition-colors text-gray-400 hover:text-purple-400"
              >
                {separating ? <><Loader2 className="w-5 h-5 animate-spin" /> Separating stems...</> : <><Upload className="w-5 h-5" /> Drop audio or click to upload</>}
              </button>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-3">Or use a SoundMint track ID</p>
              <div className="flex gap-2">
                <input type="text" value={trackId} onChange={(e) => setTrackId(e.target.value)} placeholder="Track ID..." className={inputClass} />
                <button onClick={handleTrackSeparate} disabled={separating} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white">
                  {separating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Split'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Studio Layout */}
      {hasStemData && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Mixing Console - 3 cols */}
          <div className="lg:col-span-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Mixing Console</h2>
                <div className="flex gap-2">
                  {trackId && (
                    <button onClick={saveVersion} className="text-xs text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded bg-purple-500/10 flex items-center gap-1">
                      <Save className="w-3 h-3" /> Save Version
                    </button>
                  )}
                  {trackId && versions.length > 0 && (
                    <button onClick={() => setShowVersions(!showVersions)} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded bg-gray-800 flex items-center gap-1">
                      <History className="w-3 h-3" /> {versions.length} Versions
                    </button>
                  )}
                  <button onClick={() => { setStems(DEFAULT_STEMS.map(s => ({ ...s, effects: { ...DEFAULT_EFFECTS } }))); setMixUrl(null); setSourceAudioUrl(null); }} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded bg-gray-800">
                    Reset
                  </button>
                </div>
              </div>

              {/* Channel Strips */}
              <div className="grid grid-cols-4 gap-4">
                {stems.map((stem, i) => (
                  <StemChannel key={stem.name} stem={stem} onChange={(updates) => updateStem(i, updates)} />
                ))}
              </div>
            </div>

            {/* Version History Panel */}
            {showVersions && versions.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mt-4">
                <h3 className="text-sm font-semibold mb-3">Version History</h3>
                <div className="space-y-2">
                  {versions.map((v) => (
                    <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm text-white">{v.name}</p>
                        <p className="text-xs text-gray-500">{new Date(v.created_at).toLocaleString()}</p>
                      </div>
                      <button onClick={() => restoreVersion(v)} className="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded bg-purple-500/10">
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Analysis */}
          <div className="space-y-4">
            <AnalysisPanel audioUrl={sourceAudioUrl || stems.find(s => s.url)?.url || null} />

            {/* Quick Info */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Channel Guide</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <p><span className="text-red-400 font-semibold">Drums</span> — kick, snare, hats, percussion</p>
                <p><span className="text-blue-400 font-semibold">Bass</span> — bass guitar, sub bass, low synths</p>
                <p><span className="text-green-400 font-semibold">Vocals</span> — lead vocals, backing vocals</p>
                <p><span className="text-purple-400 font-semibold">Other</span> — melody, pads, keys, guitar</p>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
                <p><strong>M</strong> = Mute channel</p>
                <p><strong>S</strong> = Solo channel</p>
                <p>Click <strong>arrow</strong> to expand EQ, compression, delay, chorus, reverb</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export / Playback */}
      {hasStemData && (
        <div className="flex gap-4">
          <button onClick={handleMix} disabled={mixing} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
            {mixing ? <><Loader2 className="w-4 h-4 animate-spin" /> Mixing & Mastering...</> : <><Disc3 className="w-4 h-4" /> Export Mix (MP3, Mastered)</>}
          </button>
          {mixUrl && (
            <>
              <audio ref={audioRef} src={mixUrl} onEnded={() => setIsPlaying(false)} />
              <button onClick={togglePlay} className="w-12 h-12 bg-green-600 hover:bg-green-700 rounded-lg flex items-center justify-center text-white">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <a href={mixUrl} download="soundmint-mix.mp3" className="w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-300">
                <Download className="w-5 h-5" />
              </a>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasStemData && !separating && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Music className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">Upload audio or enter a track ID to start mixing</p>
        </div>
      )}
    </div>
  );
}
