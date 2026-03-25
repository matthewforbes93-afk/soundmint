'use client';

import { useState } from 'react';
import { Download, Loader2, X, Check } from 'lucide-react';

interface TrackInfo {
  name: string;
  url: string | null;
  volume: number;
  pan: number;
  mute: boolean;
}

interface ExportDialogProps {
  tracks: TrackInfo[];
  title: string;
  onClose: () => void;
}

export default function ExportDialog({ tracks, title, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [master, setMaster] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ url: string; format: string } | null>(null);
  const [exportStems, setExportStems] = useState(false);

  const playableTracks = tracks.filter(t => t.url && !t.mute);

  async function handleExport() {
    if (playableTracks.length === 0) return;
    setExporting(true);

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackUrls: playableTracks.map(t => ({
            url: t.url,
            name: t.name,
            volume: t.volume,
            pan: t.pan,
            mute: t.mute,
          })),
          format,
          master,
          title,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ url: data.audio_url, format: data.format });
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#111118] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">Export Song</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Track list */}
          <div>
            <p className="text-xs text-gray-400 mb-2">{playableTracks.length} tracks will be mixed</p>
            <div className="space-y-1 max-h-32 overflow-auto">
              {tracks.map((t, i) => (
                <div key={i} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${t.url && !t.mute ? 'text-white bg-white/5' : 'text-gray-600'}`}>
                  <div className={`w-2 h-2 rounded-full ${t.url && !t.mute ? 'bg-teal-500' : 'bg-gray-700'}`} />
                  {t.name}
                  {!t.url && <span className="text-gray-700 ml-auto">no audio</span>}
                  {t.mute && <span className="text-red-500/50 ml-auto">muted</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Format</p>
            <div className="flex gap-2">
              {(['mp3', 'wav'] as const).map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${format === f ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-white/5 text-gray-400 border border-white/5'}`}>
                  {f.toUpperCase()}
                  <span className="block text-[9px] text-gray-500">{f === 'mp3' ? '320kbps' : 'Lossless'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Master */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white">Auto-Master</p>
              <p className="text-[9px] text-gray-500">-14 LUFS (Spotify/Apple Music standard)</p>
            </div>
            <button onClick={() => setMaster(!master)}
              className={`relative w-11 h-6 rounded-full transition-colors ${master ? 'bg-teal-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${master ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Export stems toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white">Export Individual Stems</p>
              <p className="text-[9px] text-gray-500">Download each track separately</p>
            </div>
            <button onClick={() => setExportStems(!exportStems)}
              className={`relative w-11 h-6 rounded-full transition-colors ${exportStems ? 'bg-teal-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${exportStems ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 flex items-center gap-3">
              <Check className="w-5 h-5 text-teal-400" />
              <div className="flex-1">
                <p className="text-sm text-teal-400 font-medium">Export complete!</p>
                <p className="text-[9px] text-gray-400">Saved to library &bull; {result.format.toUpperCase()}</p>
              </div>
              <a href={result.url} download={`${title}.${result.format}`}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 rounded text-sm text-white font-medium">
                Download
              </a>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/5">
          {!result ? (
            <button onClick={handleExport}
              disabled={exporting || playableTracks.length === 0}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2">
              {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Mixing &amp; Mastering...</> : <><Download className="w-4 h-4" /> Export Song</>}
            </button>
          ) : (
            <button onClick={onClose} className="w-full bg-white/10 hover:bg-white/15 text-white font-medium py-3 rounded-lg">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
