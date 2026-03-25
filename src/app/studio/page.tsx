'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward, Mic, CircleDot,
  Volume2, Plus, Trash2, Upload, Download, Loader2, Save, History,
  ChevronDown, ChevronUp, Repeat, Music, Sliders, Layers, Wand2,
  Settings2, Headphones, Radio, Disc3, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import AnalysisPanel from '@/components/AnalysisPanel';

// --- Types ---
interface TrackLane {
  id: string;
  name: string;
  color: string;
  type: 'audio' | 'midi' | 'ai';
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  armed: boolean;
  audioUrl: string | null;
  waveform: number[];
  effects: {
    eq: { low: number; mid: number; high: number };
    compression: { threshold: number; ratio: number };
    reverb: number;
    delay: number;
  };
}

const TRACK_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-yellow-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500',
];

function generateWaveform(length: number = 200): number[] {
  return Array.from({ length }, () => Math.random() * 0.8 + 0.1);
}

function createTrack(name: string, index: number, type: TrackLane['type'] = 'audio'): TrackLane {
  return {
    id: `track-${Date.now()}-${index}`,
    name,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    type,
    volume: 75,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
    audioUrl: null,
    waveform: [],
    effects: { eq: { low: 0, mid: 0, high: 0 }, compression: { threshold: -20, ratio: 4 }, reverb: 0, delay: 0 },
  };
}

// --- Main Studio ---
export default function StudioPage() {
  const [tracks, setTracks] = useState<TrackLane[]>([
    { ...createTrack('Master', 0), waveform: generateWaveform() },
  ]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [key, setKey] = useState('C');
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [position, setPosition] = useState('1.1.1');
  const [time, setTime] = useState('0:00.0');
  const [looping, setLooping] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [bottomPanel, setBottomPanel] = useState<'mixer' | 'effects' | 'browser' | null>('mixer');
  const [zoom, setZoom] = useState(1);
  const [playheadPos, setPlayheadPos] = useState(0);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Playback animation
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = Date.now() - playheadPos * 1000;
      const animate = () => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setPlayheadPos(elapsed);
        const mins = Math.floor(elapsed / 60);
        const secs = (elapsed % 60).toFixed(1);
        setTime(`${mins}:${secs.padStart(4, '0')}`);
        const beat = Math.floor(elapsed * bpm / 60);
        const bar = Math.floor(beat / 4) + 1;
        const beatInBar = (beat % 4) + 1;
        setPosition(`${bar}.${beatInBar}.1`);
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animRef.current);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, bpm, playheadPos]);

  function addTrack(type: TrackLane['type'] = 'audio') {
    const names: Record<string, string> = { audio: `Audio ${tracks.length + 1}`, midi: `MIDI ${tracks.length + 1}`, ai: `AI Track ${tracks.length + 1}` };
    setTracks(prev => [...prev, { ...createTrack(names[type], prev.length, type), waveform: type === 'ai' ? generateWaveform() : [] }]);
  }

  function removeTrack(id: string) {
    setTracks(prev => prev.filter(t => t.id !== id));
  }

  function updateTrack(id: string, updates: Partial<TrackLane>) {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  function togglePlay() {
    setIsPlaying(!isPlaying);
    setIsRecording(false);
  }

  function stop() {
    setIsPlaying(false);
    setIsRecording(false);
    setPlayheadPos(0);
    setTime('0:00.0');
    setPosition('1.1.1');
  }

  function toggleRecord() {
    setIsRecording(!isRecording);
    if (!isRecording) setIsPlaying(true);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950">
      {/* ===== TOP TRANSPORT BAR ===== */}
      <div className="h-14 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/50 flex items-center px-4 gap-2 flex-shrink-0">
        {/* Transport Controls */}
        <div className="flex items-center gap-1 mr-4">
          <button onClick={stop} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400 hover:text-white">
            <SkipBack className="w-4 h-4" />
          </button>
          <button onClick={togglePlay}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${isPlaying ? 'bg-white text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button onClick={stop} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400 hover:text-white">
            <Square className="w-3.5 h-3.5" />
          </button>
          <button onClick={toggleRecord}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-800 text-red-400 hover:bg-gray-700'}`}>
            <CircleDot className="w-4 h-4" />
          </button>
          <button onClick={() => setLooping(!looping)}
            className={`w-8 h-8 flex items-center justify-center rounded transition-all ${looping ? 'bg-purple-600/30 text-purple-400' : 'text-gray-500 hover:text-white'}`}>
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Position Display */}
        <div className="bg-black/60 rounded-lg px-4 py-1.5 flex items-center gap-4 border border-gray-800/50 mr-4">
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Position</p>
            <p className="text-sm font-mono text-green-400 font-bold">{position}</p>
          </div>
          <div className="w-px h-6 bg-gray-800" />
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Time</p>
            <p className="text-sm font-mono text-green-400 font-bold">{time}</p>
          </div>
        </div>

        {/* BPM / Key / Time Sig */}
        <div className="flex items-center gap-2 mr-4">
          <div className="bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-700/30">
            <p className="text-[10px] text-gray-500 uppercase">BPM</p>
            <input type="number" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
              className="w-12 bg-transparent text-sm font-mono text-white font-bold focus:outline-none" />
          </div>
          <div className="bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-700/30">
            <p className="text-[10px] text-gray-500 uppercase">Key</p>
            <select value={key} onChange={(e) => setKey(e.target.value)}
              className="bg-transparent text-sm font-mono text-white font-bold focus:outline-none cursor-pointer">
              {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k =>
                <option key={k} value={k} className="bg-gray-900">{k}</option>
              )}
            </select>
          </div>
          <div className="bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-700/30">
            <p className="text-[10px] text-gray-500 uppercase">Time</p>
            <select value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)}
              className="bg-transparent text-sm font-mono text-white font-bold focus:outline-none cursor-pointer">
              {['4/4', '3/4', '6/8', '2/4', '5/4'].map(ts =>
                <option key={ts} value={ts} className="bg-gray-900">{ts}</option>
              )}
            </select>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg px-2 py-1 border border-gray-700/30">
            <span className="text-[10px] text-gray-500">Zoom</span>
            <input type="range" min={0.5} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-16 accent-purple-500" />
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400 hover:text-white">
            <Headphones className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400 hover:text-white">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ===== MAIN AREA ===== */}
      <div className="flex flex-1 overflow-hidden">
        {/* ===== TRACK LIST + TIMELINE ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline ruler */}
          <div className="h-8 bg-gray-900/50 border-b border-gray-800/30 flex flex-shrink-0">
            <div className="w-60 flex-shrink-0 border-r border-gray-800/30 flex items-center px-3">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Tracks ({tracks.length})</span>
            </div>
            <div className="flex-1 relative overflow-hidden">
              {/* Bar markers */}
              <div className="flex h-full items-end">
                {Array.from({ length: Math.ceil(32 * zoom) }, (_, i) => (
                  <div key={i} className="flex-shrink-0 border-l border-gray-800/30 h-full flex items-end px-1"
                    style={{ width: `${100 / (32 * zoom)}%`, minWidth: 40 }}>
                    <span className="text-[9px] text-gray-600 mb-1">{i + 1}</span>
                  </div>
                ))}
              </div>
              {/* Playhead */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-green-400 z-20 transition-none"
                style={{ left: `${(playheadPos / (32 * 60 / bpm)) * 100}%` }}>
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full -ml-1" />
              </div>
            </div>
          </div>

          {/* Track lanes */}
          <div className="flex-1 overflow-y-auto">
            {tracks.map((track) => (
              <div key={track.id}
                className={`flex border-b border-gray-800/20 h-20 group ${selectedTrack === track.id ? 'bg-gray-800/20' : 'hover:bg-gray-800/10'}`}
                onClick={() => setSelectedTrack(track.id)}>

                {/* Track header */}
                <div className="w-60 flex-shrink-0 border-r border-gray-800/30 p-2 flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-8 rounded-full ${track.color}`} />
                    <div className="flex-1 min-w-0">
                      <input type="text" value={track.name}
                        onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                        className="text-xs font-medium text-white bg-transparent w-full focus:outline-none focus:bg-gray-800 rounded px-1" />
                      <p className="text-[10px] text-gray-600 px-1">{track.type.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { mute: !track.mute }); }}
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${track.mute ? 'bg-red-500/30 text-red-400' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}>M</button>
                    <button onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${track.solo ? 'bg-yellow-500/30 text-yellow-400' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}>S</button>
                    <button onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { armed: !track.armed }); }}
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${track.armed ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}>R</button>
                    <input type="range" min={0} max={100} value={track.volume}
                      onChange={(e) => updateTrack(track.id, { volume: parseInt(e.target.value) })}
                      className="w-14 accent-purple-500 ml-1" />
                    <span className="text-[9px] text-gray-500 w-6">{track.volume}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Waveform area */}
                <div className="flex-1 relative overflow-hidden">
                  {track.waveform.length > 0 ? (
                    <div className="absolute inset-0 flex items-center px-1">
                      <div className={`h-full w-3/4 rounded-md ${track.mute ? 'opacity-30' : 'opacity-80'} flex items-center overflow-hidden`}
                        style={{ background: `linear-gradient(90deg, ${track.color.replace('bg-', '').replace('-500', '')}22, ${track.color.replace('bg-', '').replace('-500', '')}11)` }}>
                        <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
                          {track.waveform.map((v, i) => (
                            <rect key={i} x={i} y={30 - v * 25} width={0.8} height={v * 50}
                              className={track.color.replace('bg-', 'fill-').replace('-500', '-400')} opacity={0.7} />
                          ))}
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-[10px] text-gray-700">Empty — record or drop audio here</p>
                    </div>
                  )}
                  {/* Playhead line */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-green-400/50 z-10"
                    style={{ left: `${(playheadPos / (32 * 60 / bpm)) * 100}%` }} />
                </div>
              </div>
            ))}

            {/* Add track button */}
            <div className="h-12 flex items-center border-b border-gray-800/20">
              <div className="w-60 flex-shrink-0 border-r border-gray-800/30 px-3 flex gap-2">
                <button onClick={() => addTrack('audio')}
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-purple-400 px-2 py-1 rounded hover:bg-gray-800">
                  <Plus className="w-3 h-3" /> Audio
                </button>
                <button onClick={() => addTrack('midi')}
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-400 px-2 py-1 rounded hover:bg-gray-800">
                  <Plus className="w-3 h-3" /> MIDI
                </button>
                <button onClick={() => addTrack('ai')}
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-pink-400 px-2 py-1 rounded hover:bg-gray-800">
                  <Wand2 className="w-3 h-3" /> AI
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM PANEL ===== */}
      <div className="flex-shrink-0 border-t border-gray-800/50">
        {/* Panel tabs */}
        <div className="h-8 bg-gray-900/50 flex items-center px-2 gap-1">
          {[
            { id: 'mixer' as const, label: 'Mixer', icon: Sliders },
            { id: 'effects' as const, label: 'Effects', icon: Activity },
            { id: 'browser' as const, label: 'Browser', icon: Music },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setBottomPanel(bottomPanel === id ? null : id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                bottomPanel === id ? 'bg-purple-600/20 text-purple-400' : 'text-gray-500 hover:text-white hover:bg-gray-800/50'
              }`}>
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        {bottomPanel && (
          <div className="h-48 bg-gray-900/30 overflow-auto">
            {bottomPanel === 'mixer' && (
              <div className="flex h-full p-2 gap-1 overflow-x-auto">
                {tracks.map((track) => (
                  <div key={track.id} className="w-20 flex-shrink-0 bg-gray-800/30 rounded-lg p-2 flex flex-col items-center border border-gray-800/30">
                    <div className={`w-1.5 h-1.5 rounded-full ${track.color} mb-1`} />
                    <p className="text-[9px] text-gray-400 truncate w-full text-center mb-1">{track.name}</p>

                    {/* Pan knob */}
                    <div className="text-[8px] text-gray-600 mb-0.5">PAN</div>
                    <input type="range" min={-100} max={100} value={track.pan}
                      onChange={(e) => updateTrack(track.id, { pan: parseInt(e.target.value) })}
                      className="w-14 accent-purple-500 mb-1" />

                    {/* Volume fader */}
                    <div className="flex-1 flex flex-col items-center justify-end">
                      <input type="range" min={0} max={100} value={track.volume}
                        onChange={(e) => updateTrack(track.id, { volume: parseInt(e.target.value) })}
                        className="w-2 accent-green-500 appearance-none cursor-pointer"
                        style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 60 }} />
                      <span className="text-[9px] text-gray-500 mt-1">{track.volume}</span>
                    </div>

                    {/* Mute/Solo */}
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => updateTrack(track.id, { mute: !track.mute })}
                        className={`text-[8px] px-1 py-0.5 rounded font-bold ${track.mute ? 'bg-red-500/30 text-red-400' : 'bg-gray-700 text-gray-500'}`}>M</button>
                      <button onClick={() => updateTrack(track.id, { solo: !track.solo })}
                        className={`text-[8px] px-1 py-0.5 rounded font-bold ${track.solo ? 'bg-yellow-500/30 text-yellow-400' : 'bg-gray-700 text-gray-500'}`}>S</button>
                    </div>
                  </div>
                ))}

                {/* Master fader */}
                <div className="w-24 flex-shrink-0 bg-gray-800/50 rounded-lg p-2 flex flex-col items-center border border-purple-800/20">
                  <p className="text-[9px] text-purple-400 font-bold mb-2">MASTER</p>
                  <div className="flex-1 flex items-center gap-1">
                    {/* Level meters */}
                    <div className="flex flex-col gap-px h-full justify-end">
                      {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-sm ${
                          i < 3 ? 'bg-red-500' : i < 5 ? 'bg-yellow-500' : 'bg-green-500'
                        } ${i < (isPlaying ? 8 + Math.floor(Math.random() * 4) : 0) ? 'opacity-80' : 'opacity-10'}`} />
                      ))}
                    </div>
                    <input type="range" min={0} max={100} value={80}
                      className="w-2 accent-purple-500 appearance-none cursor-pointer"
                      style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 80 }} />
                    <div className="flex flex-col gap-px h-full justify-end">
                      {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-sm ${
                          i < 3 ? 'bg-red-500' : i < 5 ? 'bg-yellow-500' : 'bg-green-500'
                        } ${i < (isPlaying ? 7 + Math.floor(Math.random() * 5) : 0) ? 'opacity-80' : 'opacity-10'}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[9px] text-gray-500 mt-1">0 dB</span>
                </div>
              </div>
            )}

            {bottomPanel === 'effects' && selectedTrack && (
              <div className="p-4">
                <div className="flex gap-4">
                  {/* EQ */}
                  <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-800/30 flex-1">
                    <p className="text-[10px] text-purple-400 font-bold mb-2">PARAMETRIC EQ</p>
                    {(['low', 'mid', 'high'] as const).map(band => {
                      const track = tracks.find(t => t.id === selectedTrack);
                      return (
                        <div key={band} className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] text-gray-500 w-6 uppercase">{band}</span>
                          <input type="range" min={-12} max={12} value={track?.effects.eq[band] || 0}
                            onChange={(e) => {
                              const t = tracks.find(tr => tr.id === selectedTrack);
                              if (t) updateTrack(t.id, { effects: { ...t.effects, eq: { ...t.effects.eq, [band]: parseInt(e.target.value) } } });
                            }}
                            className="flex-1 accent-purple-500" />
                          <span className="text-[9px] text-gray-500 w-8">{track?.effects.eq[band] || 0}dB</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Compressor */}
                  <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-800/30 flex-1">
                    <p className="text-[10px] text-blue-400 font-bold mb-2">COMPRESSOR</p>
                    {(() => {
                      const track = tracks.find(t => t.id === selectedTrack);
                      return (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] text-gray-500 w-10">Thresh</span>
                            <input type="range" min={-40} max={0} value={track?.effects.compression.threshold || -20}
                              onChange={(e) => { if (track) updateTrack(track.id, { effects: { ...track.effects, compression: { ...track.effects.compression, threshold: parseInt(e.target.value) } } }); }}
                              className="flex-1 accent-blue-500" />
                            <span className="text-[9px] text-gray-500 w-10">{track?.effects.compression.threshold}dB</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-500 w-10">Ratio</span>
                            <input type="range" min={1} max={20} value={track?.effects.compression.ratio || 4}
                              onChange={(e) => { if (track) updateTrack(track.id, { effects: { ...track.effects, compression: { ...track.effects.compression, ratio: parseInt(e.target.value) } } }); }}
                              className="flex-1 accent-blue-500" />
                            <span className="text-[9px] text-gray-500 w-10">{track?.effects.compression.ratio}:1</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {/* Reverb & Delay */}
                  <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-800/30 flex-1">
                    <p className="text-[10px] text-green-400 font-bold mb-2">REVERB / DELAY</p>
                    {(() => {
                      const track = tracks.find(t => t.id === selectedTrack);
                      return (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] text-gray-500 w-10">Reverb</span>
                            <input type="range" min={0} max={100} value={track?.effects.reverb || 0}
                              onChange={(e) => { if (track) updateTrack(track.id, { effects: { ...track.effects, reverb: parseInt(e.target.value) } }); }}
                              className="flex-1 accent-green-500" />
                            <span className="text-[9px] text-gray-500 w-8">{track?.effects.reverb}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-500 w-10">Delay</span>
                            <input type="range" min={0} max={100} value={track?.effects.delay || 0}
                              onChange={(e) => { if (track) updateTrack(track.id, { effects: { ...track.effects, delay: parseInt(e.target.value) } }); }}
                              className="flex-1 accent-green-500" />
                            <span className="text-[9px] text-gray-500 w-8">{track?.effects.delay}%</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {bottomPanel === 'effects' && !selectedTrack && (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                Select a track to edit effects
              </div>
            )}

            {bottomPanel === 'browser' && (
              <div className="p-4 grid grid-cols-4 gap-2">
                {['Kick', 'Snare', 'Hi-Hat', 'Clap', 'Bass 808', 'Piano Loop', 'Guitar Riff', 'Vocal Chop',
                  'Pad Ambient', 'Synth Lead', 'String Section', 'FX Riser', 'Brass Hit', 'Drum Loop', 'Vinyl Noise', 'Bell'
                ].map(sample => (
                  <button key={sample}
                    className="bg-gray-800/30 hover:bg-gray-800/60 border border-gray-800/30 rounded-lg p-2 text-left transition-colors group">
                    <div className="flex items-center gap-2">
                      <Play className="w-3 h-3 text-gray-600 group-hover:text-purple-400" />
                      <span className="text-[11px] text-gray-400 group-hover:text-white">{sample}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
