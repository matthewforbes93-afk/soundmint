'use client';

import { useState, useRef } from 'react';
import { Sliders, Upload, Play, Pause, Download, Loader2, Music, Disc3 } from 'lucide-react';
import toast from 'react-hot-toast';

interface StemConfig {
  name: string;
  url: string | null;
  data: string | null;
  format: string;
  volume: number;
  pan: number;
  reverb: number;
  mute: boolean;
  solo: boolean;
  color: string;
}

const STEM_COLORS: Record<string, string> = {
  drums: 'bg-red-500',
  bass: 'bg-blue-500',
  vocals: 'bg-green-500',
  other: 'bg-purple-500',
};

const DEFAULT_STEMS: StemConfig[] = [
  { name: 'drums', url: null, data: null, format: 'wav', volume: 0, pan: 0, reverb: 0, mute: false, solo: false, color: 'bg-red-500' },
  { name: 'bass', url: null, data: null, format: 'wav', volume: 0, pan: 0, reverb: 0, mute: false, solo: false, color: 'bg-blue-500' },
  { name: 'vocals', url: null, data: null, format: 'wav', volume: 0, pan: 0, reverb: 0, mute: false, solo: false, color: 'bg-green-500' },
  { name: 'other', url: null, data: null, format: 'wav', volume: 0, pan: -0, reverb: 0, mute: false, solo: false, color: 'bg-purple-500' },
];

export default function StudioPage() {
  const [stems, setStems] = useState<StemConfig[]>(DEFAULT_STEMS);
  const [separating, setSeparating] = useState(false);
  const [mixing, setMixing] = useState(false);
  const [mixUrl, setMixUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackId, setTrackId] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await separateAudio(file);
  }

  async function handleTrackSeparate() {
    if (!trackId.trim()) return toast.error('Enter a track ID');
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
        data: null, // URLs are stored in Supabase
      })));

      toast.success(`Separated into ${data.stem_names.length} stems!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Separation failed');
    } finally {
      setSeparating(false);
    }
  }

  function updateStem(index: number, updates: Partial<StemConfig>) {
    setStems(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }

  async function handleMix() {
    const activeStemData: Record<string, unknown> = {};
    const hasSolo = stems.some(s => s.solo);

    for (const stem of stems) {
      if (!stem.url) continue;
      const isActive = hasSolo ? stem.solo : !stem.mute;
      if (!isActive) continue;

      // Fetch stem audio and convert to base64
      const res = await fetch(stem.url);
      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      activeStemData[stem.name] = {
        data: b64,
        format: stem.format,
        volume: stem.volume,
        pan: stem.pan,
        reverb: stem.reverb,
        mute: false,
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
        body: JSON.stringify({ stems: activeStemData, format: 'mp3', master: true }),
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

  function togglePlay() {
    if (!mixUrl || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
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
        <p className="text-gray-400 text-sm mt-1">Separate stems, mix, and master your tracks</p>
      </div>

      {/* Upload / Separate Section */}
      {!hasStemData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Load Audio</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Upload */}
            <div>
              <p className="text-sm text-gray-400 mb-3">Upload an audio file</p>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={separating}
                className="w-full flex items-center justify-center gap-2 py-12 border-2 border-dashed border-gray-700 rounded-xl hover:border-purple-500 transition-colors text-gray-400 hover:text-purple-400"
              >
                {separating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Separating stems...</>
                ) : (
                  <><Upload className="w-5 h-5" /> Drop audio or click to upload</>
                )}
              </button>
            </div>

            {/* Track ID */}
            <div>
              <p className="text-sm text-gray-400 mb-3">Or use a SoundMint track ID</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  placeholder="Track ID..."
                  className={inputClass}
                />
                <button
                  onClick={handleTrackSeparate}
                  disabled={separating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
                >
                  {separating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Split'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mixing Console */}
      {hasStemData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Mixing Console</h2>
            <button
              onClick={() => { setStems(DEFAULT_STEMS); setMixUrl(null); }}
              className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded bg-gray-800"
            >
              Reset
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {stems.map((stem, i) => (
              <div key={stem.name} className={`bg-gray-800 rounded-xl p-4 border ${stem.url ? 'border-gray-700' : 'border-gray-800 opacity-40'}`}>
                {/* Stem Header */}
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-3 h-3 rounded-full ${STEM_COLORS[stem.name] || 'bg-gray-500'}`} />
                  <span className="text-sm font-semibold uppercase text-white">{stem.name}</span>
                </div>

                {/* Volume Fader */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Volume</span>
                    <span>{stem.volume > 0 ? '+' : ''}{stem.volume} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-20}
                    max={10}
                    value={stem.volume}
                    onChange={(e) => updateStem(i, { volume: parseInt(e.target.value) })}
                    className="w-full accent-purple-500"
                    disabled={!stem.url}
                  />
                </div>

                {/* Pan */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Pan</span>
                    <span>{stem.pan === 0 ? 'C' : stem.pan < 0 ? `L${Math.abs(Math.round(stem.pan * 100))}` : `R${Math.round(stem.pan * 100)}`}</span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={stem.pan * 100}
                    onChange={(e) => updateStem(i, { pan: parseInt(e.target.value) / 100 })}
                    className="w-full accent-purple-500"
                    disabled={!stem.url}
                  />
                </div>

                {/* Reverb */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Reverb</span>
                    <span>{Math.round(stem.reverb * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={stem.reverb * 100}
                    onChange={(e) => updateStem(i, { reverb: parseInt(e.target.value) / 100 })}
                    className="w-full accent-purple-500"
                    disabled={!stem.url}
                  />
                </div>

                {/* Mute / Solo */}
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStem(i, { mute: !stem.mute })}
                    disabled={!stem.url}
                    className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                      stem.mute ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    M
                  </button>
                  <button
                    onClick={() => updateStem(i, { solo: !stem.solo })}
                    disabled={!stem.url}
                    className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                      stem.solo ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export / Playback */}
      {hasStemData && (
        <div className="flex gap-4">
          <button
            onClick={handleMix}
            disabled={mixing}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {mixing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Mixing & Mastering...</>
            ) : (
              <><Disc3 className="w-4 h-4" /> Export Mix (MP3, Mastered)</>
            )}
          </button>

          {mixUrl && (
            <>
              <audio ref={audioRef} src={mixUrl} onEnded={() => setIsPlaying(false)} />
              <button
                onClick={togglePlay}
                className="w-12 h-12 bg-green-600 hover:bg-green-700 rounded-lg flex items-center justify-center text-white"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <a
                href={mixUrl}
                download="soundmint-mix.mp3"
                className="w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-300"
              >
                <Download className="w-5 h-5" />
              </a>
            </>
          )}
        </div>
      )}

      {/* No stems state */}
      {!hasStemData && !separating && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Music className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">Upload audio or enter a track ID to start mixing</p>
        </div>
      )}
    </div>
  );
}
