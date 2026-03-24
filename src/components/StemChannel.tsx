'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface StemEffects {
  eq: { low: number; mid: number; high: number };
  compression: { threshold: number; ratio: number };
  delay: { time: number; feedback: number; mix: number };
  chorus: { depth: number };
  reverb: { amount: number };
}

export const DEFAULT_EFFECTS: StemEffects = {
  eq: { low: 0, mid: 0, high: 0 },
  compression: { threshold: -20, ratio: 4 },
  delay: { time: 300, feedback: 0.4, mix: 0 },
  chorus: { depth: 0 },
  reverb: { amount: 0 },
};

export interface StemChannelConfig {
  name: string;
  url: string | null;
  data: string | null;
  format: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  effects: StemEffects;
  color: string;
}

interface StemChannelProps {
  stem: StemChannelConfig;
  onChange: (updates: Partial<StemChannelConfig>) => void;
}

export default function StemChannel({ stem, onChange }: StemChannelProps) {
  const [expanded, setExpanded] = useState(false);

  function updateEffect<K extends keyof StemEffects>(effectName: K, updates: Partial<StemEffects[K]>) {
    onChange({
      effects: {
        ...stem.effects,
        [effectName]: { ...stem.effects[effectName], ...updates },
      },
    });
  }

  const disabled = !stem.url;
  const sliderClass = 'w-full accent-purple-500';

  return (
    <div className={`bg-gray-800 rounded-xl p-4 border ${stem.url ? 'border-gray-700' : 'border-gray-800 opacity-40'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${stem.color}`} />
        <span className="text-sm font-semibold uppercase text-white flex-1">{stem.name}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-white"
          disabled={disabled}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Volume */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Vol</span>
          <span>{stem.volume > 0 ? '+' : ''}{stem.volume} dB</span>
        </div>
        <input type="range" min={-20} max={10} value={stem.volume} onChange={(e) => onChange({ volume: parseInt(e.target.value) })} className={sliderClass} disabled={disabled} />
      </div>

      {/* Pan */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Pan</span>
          <span>{stem.pan === 0 ? 'C' : stem.pan < 0 ? `L${Math.abs(Math.round(stem.pan * 100))}` : `R${Math.round(stem.pan * 100)}`}</span>
        </div>
        <input type="range" min={-100} max={100} value={stem.pan * 100} onChange={(e) => onChange({ pan: parseInt(e.target.value) / 100 })} className={sliderClass} disabled={disabled} />
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => onChange({ mute: !stem.mute })} disabled={disabled} className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${stem.mute ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>M</button>
        <button onClick={() => onChange({ solo: !stem.solo })} disabled={disabled} className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${stem.solo ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>S</button>
      </div>

      {/* Expanded Effects */}
      {expanded && stem.url && (
        <div className="space-y-3 pt-3 border-t border-gray-700">
          {/* EQ */}
          <div>
            <p className="text-xs text-purple-400 font-semibold mb-2">EQ</p>
            <div className="space-y-1">
              {(['low', 'mid', 'high'] as const).map((band) => (
                <div key={band} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-8">{band.charAt(0).toUpperCase() + band.slice(1)}</span>
                  <input type="range" min={-12} max={12} value={stem.effects.eq[band]} onChange={(e) => updateEffect('eq', { [band]: parseInt(e.target.value) })} className="flex-1 accent-purple-500" />
                  <span className="text-xs text-gray-500 w-8">{stem.effects.eq[band] > 0 ? '+' : ''}{stem.effects.eq[band]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Compression */}
          <div>
            <p className="text-xs text-blue-400 font-semibold mb-2">Compression</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Thresh</span>
                <input type="range" min={-40} max={0} value={stem.effects.compression.threshold} onChange={(e) => updateEffect('compression', { threshold: parseInt(e.target.value) })} className="flex-1 accent-blue-500" />
                <span className="text-xs text-gray-500 w-10">{stem.effects.compression.threshold}dB</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Ratio</span>
                <input type="range" min={1} max={20} value={stem.effects.compression.ratio} onChange={(e) => updateEffect('compression', { ratio: parseInt(e.target.value) })} className="flex-1 accent-blue-500" />
                <span className="text-xs text-gray-500 w-10">{stem.effects.compression.ratio}:1</span>
              </div>
            </div>
          </div>

          {/* Reverb */}
          <div>
            <p className="text-xs text-green-400 font-semibold mb-2">Reverb</p>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={stem.effects.reverb.amount * 100} onChange={(e) => updateEffect('reverb', { amount: parseInt(e.target.value) / 100 })} className="flex-1 accent-green-500" />
              <span className="text-xs text-gray-500 w-8">{Math.round(stem.effects.reverb.amount * 100)}%</span>
            </div>
          </div>

          {/* Delay */}
          <div>
            <p className="text-xs text-yellow-400 font-semibold mb-2">Delay</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Time</span>
                <input type="range" min={50} max={1000} step={50} value={stem.effects.delay.time} onChange={(e) => updateEffect('delay', { time: parseInt(e.target.value) })} className="flex-1 accent-yellow-500" />
                <span className="text-xs text-gray-500 w-10">{stem.effects.delay.time}ms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Feedback</span>
                <input type="range" min={0} max={80} value={stem.effects.delay.feedback * 100} onChange={(e) => updateEffect('delay', { feedback: parseInt(e.target.value) / 100 })} className="flex-1 accent-yellow-500" />
                <span className="text-xs text-gray-500 w-10">{Math.round(stem.effects.delay.feedback * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Mix</span>
                <input type="range" min={0} max={100} value={stem.effects.delay.mix * 100} onChange={(e) => updateEffect('delay', { mix: parseInt(e.target.value) / 100 })} className="flex-1 accent-yellow-500" />
                <span className="text-xs text-gray-500 w-10">{Math.round(stem.effects.delay.mix * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Chorus */}
          <div>
            <p className="text-xs text-pink-400 font-semibold mb-2">Chorus</p>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={stem.effects.chorus.depth * 100} onChange={(e) => updateEffect('chorus', { depth: parseInt(e.target.value) / 100 })} className="flex-1 accent-pink-500" />
              <span className="text-xs text-gray-500 w-8">{Math.round(stem.effects.chorus.depth * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
