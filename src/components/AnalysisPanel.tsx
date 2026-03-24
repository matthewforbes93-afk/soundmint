'use client';

import { useState } from 'react';
import { Activity, Music, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AnalysisResult {
  bpm: number;
  key: string;
  mode: string;
  confidence: number;
  duration_ms: number;
  channels: number;
  sample_rate: number;
}

interface AnalysisPanelProps {
  audioUrl: string | null;
}

export default function AnalysisPanel({ audioUrl }: AnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    if (!audioUrl) return toast.error('No audio to analyze');
    setLoading(true);
    try {
      // Download audio and send for analysis
      const audioRes = await fetch(audioUrl);
      const blob = await audioRes.blob();
      const file = new File([blob], 'track.mp3', { type: blob.type });

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnalysis(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-500" />
          Track Analysis
        </h3>
        <button
          onClick={handleAnalyze}
          disabled={loading || !audioUrl}
          className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Analyze'}
        </button>
      </div>

      {analysis ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{analysis.bpm}</p>
            <p className="text-xs text-gray-400">BPM</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{analysis.key} {analysis.mode === 'minor' ? 'm' : ''}</p>
            <p className="text-xs text-gray-400">Key ({Math.round(analysis.confidence * 100)}%)</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{(analysis.duration_ms / 1000).toFixed(1)}s</p>
            <p className="text-xs text-gray-400">Duration</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{analysis.sample_rate / 1000}kHz</p>
            <p className="text-xs text-gray-400">{analysis.channels === 2 ? 'Stereo' : 'Mono'}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center py-4">
          {audioUrl ? 'Click Analyze to detect BPM & key' : 'Load audio first'}
        </p>
      )}
    </div>
  );
}
