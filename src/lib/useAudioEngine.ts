/**
 * SoundMint Audio Engine
 * Centralized Web Audio API manager for the entire Studio.
 * Handles: track playback, effects chains, metering, recording, and routing.
 */

import { useRef, useCallback } from 'react';

interface TrackNode {
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer | null;
  gain: GainNode;
  pan: StereoPannerNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  analyser: AnalyserNode;
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const tracksRef = useRef<Record<string, TrackNode>>({});
  const masterGainRef = useRef<GainNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);

  function getCtx(): AudioContext {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      masterGainRef.current = ctxRef.current.createGain();
      masterAnalyserRef.current = ctxRef.current.createAnalyser();
      masterAnalyserRef.current.fftSize = 256;
      masterGainRef.current.connect(masterAnalyserRef.current);
      masterAnalyserRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }

  // Create a full effects chain for a track
  const createTrackChain = useCallback((trackId: string): TrackNode => {
    const ctx = getCtx();

    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;
    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;
    const compressor = ctx.createDynamicsCompressor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    // Chain: eqLow → eqMid → eqHigh → compressor → gain → pan → analyser → master
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(compressor);
    compressor.connect(gain);
    gain.connect(pan);
    pan.connect(analyser);
    analyser.connect(masterGainRef.current!);

    const node: TrackNode = { source: null, buffer: null, gain, pan, eqLow, eqMid, eqHigh, compressor, analyser };
    tracksRef.current[trackId] = node;
    return node;
  }, []);

  // Load audio from URL into a track
  const loadTrack = useCallback(async (trackId: string, url: string): Promise<boolean> => {
    if (url.endsWith('.webm')) return false;
    const ctx = getCtx();
    try {
      const res = await fetch(url);
      if (!res.ok) return false;
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength < 100) return false;
      const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));

      let node = tracksRef.current[trackId];
      if (!node) node = createTrackChain(trackId);
      node.buffer = audioBuf;
      return true;
    } catch {
      return false;
    }
  }, [createTrackChain]);

  // Start playback for a track
  const playTrack = useCallback((trackId: string, offset = 0, loop = true) => {
    const ctx = getCtx();
    const node = tracksRef.current[trackId];
    if (!node?.buffer) return;

    // Stop existing source
    try { node.source?.stop(); } catch { /* ok */ }

    const source = ctx.createBufferSource();
    source.buffer = node.buffer;
    source.loop = loop;
    source.connect(node.eqLow);
    source.start(0, offset);
    node.source = source;
  }, []);

  // Stop a track
  const stopTrack = useCallback((trackId: string) => {
    const node = tracksRef.current[trackId];
    if (node?.source) {
      try { node.source.stop(); } catch { /* ok */ }
      node.source = null;
    }
  }, []);

  // Stop all tracks
  const stopAll = useCallback(() => {
    Object.keys(tracksRef.current).forEach(id => stopTrack(id));
  }, [stopTrack]);

  // Update track parameters in real-time
  const updateTrackParams = useCallback((trackId: string, params: {
    volume?: number; pan?: number; mute?: boolean;
    eqLow?: number; eqMid?: number; eqHigh?: number;
    compThreshold?: number;
  }) => {
    const node = tracksRef.current[trackId];
    if (!node) return;

    if (params.volume !== undefined) node.gain.gain.value = params.mute ? 0 : params.volume / 100;
    if (params.mute !== undefined && params.volume !== undefined) node.gain.gain.value = params.mute ? 0 : params.volume / 100;
    if (params.pan !== undefined) node.pan.pan.value = params.pan / 100;
    if (params.eqLow !== undefined) node.eqLow.gain.value = params.eqLow;
    if (params.eqMid !== undefined) node.eqMid.gain.value = params.eqMid;
    if (params.eqHigh !== undefined) node.eqHigh.gain.value = params.eqHigh;
    if (params.compThreshold !== undefined) node.compressor.threshold.value = params.compThreshold;
  }, []);

  // Get real meter level for a track
  const getTrackLevel = useCallback((trackId: string): [number, number] => {
    const node = tracksRef.current[trackId];
    if (!node?.analyser) return [0, 0];
    const data = new Uint8Array(node.analyser.frequencyBinCount);
    node.analyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length / 255;
    return [avg, avg * (0.9 + Math.random() * 0.2)]; // Slight L/R variation
  }, []);

  // Get master level
  const getMasterLevel = useCallback((): [number, number] => {
    if (!masterAnalyserRef.current) return [0, 0];
    const data = new Uint8Array(masterAnalyserRef.current.frequencyBinCount);
    masterAnalyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length / 255;
    return [avg, avg * (0.9 + Math.random() * 0.2)];
  }, []);

  // Play a one-shot note (for instruments)
  const playNote = useCallback((frequency: number, type: OscillatorType = 'sawtooth', duration = 0.3) => {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(masterGainRef.current || ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }, []);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    if (masterGainRef.current) masterGainRef.current.gain.value = volume / 100;
  }, []);

  return {
    getCtx,
    createTrackChain,
    loadTrack,
    playTrack,
    stopTrack,
    stopAll,
    updateTrackParams,
    getTrackLevel,
    getMasterLevel,
    playNote,
    setMasterVolume,
  };
}
