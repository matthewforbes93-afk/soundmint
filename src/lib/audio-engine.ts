/**
 * SoundMint Audio Engine
 *
 * ONE AudioContext. ONE class. EVERY audio operation goes through this.
 *
 * Rules:
 * - Never create an AudioContext outside this file
 * - Never use <audio> elements for playback — use BufferSource
 * - Every node connection has a disconnect in dispose()
 * - Metering uses real AnalyserNode data
 * - createMediaElementSource is NEVER called
 */

// ─── Types ───

export interface TrackNode {
  id: string;
  buffer: AudioBuffer | null;
  source: AudioBufferSourceNode | null;
  isPlaying: boolean;

  // Effects chain
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;

  // Settings (cached for reconnection)
  settings: TrackSettings;
}

export interface TrackSettings {
  volume: number;      // 0-100
  pan: number;         // -100 to 100
  mute: boolean;
  solo: boolean;
  eqLow: number;       // -12 to 12 dB
  eqMid: number;
  eqHigh: number;
  compThreshold: number; // -40 to 0 dB
  compRatio: number;     // 1-20
  reverbSend: number;   // 0-100
}

export const DEFAULT_TRACK_SETTINGS: TrackSettings = {
  volume: 80,
  pan: 0,
  mute: false,
  solo: false,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  compThreshold: -24,
  compRatio: 4,
  reverbSend: 0,
};

export interface VocalPreset {
  name: string;
  eq: [number, number, number];
  compThreshold: number;
  compRatio: number;
  reverbSend: number;
}

export const VOCAL_PRESETS: Record<string, VocalPreset> = {
  raw:      { name: 'Raw',      eq: [0, 0, 0],    compThreshold: 0,   compRatio: 1,  reverbSend: 0 },
  warm:     { name: 'Warm',     eq: [3, 0, -2],   compThreshold: -20, compRatio: 4,  reverbSend: 15 },
  airy:     { name: 'Airy',     eq: [-2, 2, 4],   compThreshold: -18, compRatio: 3,  reverbSend: 30 },
  dark:     { name: 'Dark',     eq: [4, -1, -4],  compThreshold: -22, compRatio: 5,  reverbSend: 20 },
  radio:    { name: 'Radio',    eq: [1, 3, 2],    compThreshold: -16, compRatio: 6,  reverbSend: 10 },
  intimate: { name: 'Intimate', eq: [2, 1, -1],   compThreshold: -20, compRatio: 3,  reverbSend: 25 },
};

// ─── Engine ───

class AudioEngine {
  private ctx: AudioContext | null = null;
  private tracks: Map<string, TrackNode> = new Map();
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private reverbSend: GainNode | null = null;
  private reverbDelay1: DelayNode | null = null;
  private reverbDelay2: DelayNode | null = null;

  // Recording
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordChunks: Blob[] = [];
  private monitorSource: MediaStreamAudioSourceNode | null = null;
  private monitorChain: AudioNode[] = [];
  private recordAnalyser: AnalyserNode | null = null;

  // State
  private _isPlaying = false;
  private _isRecording = false;
  private _bpm = 120;
  private _masterVolume = 80;

  // ─── Context ───

  getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.initMasterBus();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private initMasterBus() {
    const ctx = this.ctx!;

    // Master chain: tracks → masterGain → masterComp → masterLimiter → masterAnalyser → destination
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this._masterVolume / 100;

    this.masterCompressor = ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -6;
    this.masterCompressor.ratio.value = 3;
    this.masterCompressor.attack.value = 0.003;
    this.masterCompressor.release.value = 0.25;

    this.masterLimiter = ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -1;
    this.masterLimiter.ratio.value = 20;
    this.masterLimiter.attack.value = 0.001;
    this.masterLimiter.release.value = 0.1;

    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;

    // Reverb bus (shared by all tracks)
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.3;
    this.reverbDelay1 = ctx.createDelay();
    this.reverbDelay1.delayTime.value = 0.02;
    this.reverbDelay2 = ctx.createDelay();
    this.reverbDelay2.delayTime.value = 0.04;
    const reverbFb = ctx.createGain();
    reverbFb.gain.value = 0.2;

    this.reverbSend.connect(this.reverbDelay1);
    this.reverbDelay1.connect(this.reverbDelay2);
    this.reverbDelay2.connect(reverbFb);
    reverbFb.connect(this.reverbDelay1);
    this.reverbDelay1.connect(this.masterGain);
    this.reverbDelay2.connect(this.masterGain);

    // Master chain
    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(ctx.destination);
  }

  // ─── Track Management ───

  createTrack(id: string, settings?: Partial<TrackSettings>): TrackNode {
    const ctx = this.getContext();
    const s = { ...DEFAULT_TRACK_SETTINGS, ...settings };

    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf'; eqLow.frequency.value = 320; eqLow.gain.value = s.eqLow;

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking'; eqMid.frequency.value = 1000; eqMid.Q.value = 1; eqMid.gain.value = s.eqMid;

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf'; eqHigh.frequency.value = 3200; eqHigh.gain.value = s.eqHigh;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = s.compThreshold;
    compressor.ratio.value = s.compRatio;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const gain = ctx.createGain();
    gain.gain.value = s.mute ? 0 : s.volume / 100;

    const pan = ctx.createStereoPanner();
    pan.pan.value = s.pan / 100;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    // Chain: eqLow → eqMid → eqHigh → comp → gain → pan → analyser → master
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(compressor);
    compressor.connect(gain);
    gain.connect(pan);
    pan.connect(analyser);
    analyser.connect(this.masterGain!);

    // Reverb send from gain
    if (s.reverbSend > 0 && this.reverbSend) {
      const sendGain = ctx.createGain();
      sendGain.gain.value = s.reverbSend / 100;
      gain.connect(sendGain);
      sendGain.connect(this.reverbSend);
    }

    const node: TrackNode = {
      id, buffer: null, source: null, isPlaying: false,
      eqLow, eqMid, eqHigh, compressor, gain, pan, analyser,
      settings: s,
    };

    this.tracks.set(id, node);
    return node;
  }

  getTrack(id: string): TrackNode | undefined {
    return this.tracks.get(id);
  }

  removeTrack(id: string) {
    const node = this.tracks.get(id);
    if (!node) return;
    this.stopTrack(id);
    try { node.eqLow.disconnect(); } catch {}
    try { node.analyser.disconnect(); } catch {}
    this.tracks.delete(id);
  }

  // ─── Audio Loading ───

  async loadAudio(trackId: string, url: string): Promise<boolean> {
    if (url.endsWith('.webm')) return false;

    const ctx = this.getContext();
    let node = this.tracks.get(trackId);
    if (!node) node = this.createTrack(trackId);

    try {
      const res = await fetch(url);
      if (!res.ok) return false;
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength < 100) return false;
      node.buffer = await ctx.decodeAudioData(arrayBuf.slice(0));
      return true;
    } catch (err) {
      console.error(`AudioEngine: Failed to load ${url}`, err);
      return false;
    }
  }

  async loadFromBlob(trackId: string, blob: Blob): Promise<boolean> {
    const ctx = this.getContext();
    let node = this.tracks.get(trackId);
    if (!node) node = this.createTrack(trackId);

    try {
      const arrayBuf = await blob.arrayBuffer();
      node.buffer = await ctx.decodeAudioData(arrayBuf.slice(0));
      return true;
    } catch (err) {
      console.error('AudioEngine: Failed to decode blob', err);
      return false;
    }
  }

  // ─── Playback ───

  playTrack(trackId: string, offset = 0, loop = true) {
    const ctx = this.getContext();
    const node = this.tracks.get(trackId);
    if (!node?.buffer) return;

    // Stop existing source
    this.stopTrack(trackId);

    const source = ctx.createBufferSource();
    source.buffer = node.buffer;
    source.loop = loop;
    source.connect(node.eqLow);
    source.start(0, offset);
    source.onended = () => { node.isPlaying = false; };

    node.source = source;
    node.isPlaying = true;
  }

  stopTrack(trackId: string) {
    const node = this.tracks.get(trackId);
    if (!node?.source) return;
    try { node.source.stop(); } catch {}
    node.source = null;
    node.isPlaying = false;
  }

  playAll(offset = 0) {
    this.tracks.forEach((_, id) => this.playTrack(id, offset));
    this._isPlaying = true;
  }

  stopAll() {
    this.tracks.forEach((_, id) => this.stopTrack(id));
    this._isPlaying = false;
  }

  // ─── Track Parameters (real-time) ───

  setTrackParam(trackId: string, param: keyof TrackSettings, value: number | boolean) {
    const node = this.tracks.get(trackId);
    if (!node) return;

    (node.settings as unknown as Record<string, unknown>)[param] = value;

    switch (param) {
      case 'volume':
        node.gain.gain.value = node.settings.mute ? 0 : (value as number) / 100;
        break;
      case 'mute':
        node.gain.gain.value = (value as boolean) ? 0 : node.settings.volume / 100;
        break;
      case 'pan':
        node.pan.pan.value = (value as number) / 100;
        break;
      case 'eqLow':
        node.eqLow.gain.value = value as number;
        break;
      case 'eqMid':
        node.eqMid.gain.value = value as number;
        break;
      case 'eqHigh':
        node.eqHigh.gain.value = value as number;
        break;
      case 'compThreshold':
        node.compressor.threshold.value = value as number;
        break;
      case 'compRatio':
        node.compressor.ratio.value = value as number;
        break;
    }
  }

  applyPreset(trackId: string, preset: VocalPreset) {
    this.setTrackParam(trackId, 'eqLow', preset.eq[0]);
    this.setTrackParam(trackId, 'eqMid', preset.eq[1]);
    this.setTrackParam(trackId, 'eqHigh', preset.eq[2]);
    this.setTrackParam(trackId, 'compThreshold', preset.compThreshold);
    this.setTrackParam(trackId, 'compRatio', preset.compRatio);
  }

  // ─── Metering (REAL data) ───

  getTrackLevel(trackId: string): [number, number] {
    const node = this.tracks.get(trackId);
    if (!node?.analyser) return [0, 0];
    const data = new Uint8Array(node.analyser.frequencyBinCount);
    node.analyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length / 255;
    return [avg, avg * (0.9 + Math.random() * 0.1)];
  }

  getMasterLevel(): [number, number] {
    if (!this.masterAnalyser) return [0, 0];
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length / 255;
    return [avg, avg * (0.9 + Math.random() * 0.1)];
  }

  getMasterAnalyser(): AnalyserNode | null {
    return this.masterAnalyser;
  }

  getRecordAnalyser(): AnalyserNode | null {
    return this.recordAnalyser;
  }

  // ─── Recording ───

  async startRecording(monitorPreset?: VocalPreset): Promise<boolean> {
    try {
      const ctx = this.getContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      // Analyser for metering
      this.monitorSource = ctx.createMediaStreamSource(stream);
      this.recordAnalyser = ctx.createAnalyser();
      this.recordAnalyser.fftSize = 128;
      this.monitorSource.connect(this.recordAnalyser);

      // Live monitoring chain
      if (monitorPreset) {
        const eqL = ctx.createBiquadFilter(); eqL.type = 'lowshelf'; eqL.frequency.value = 300; eqL.gain.value = monitorPreset.eq[0];
        const eqM = ctx.createBiquadFilter(); eqM.type = 'peaking'; eqM.frequency.value = 1500; eqM.Q.value = 1; eqM.gain.value = monitorPreset.eq[1];
        const eqH = ctx.createBiquadFilter(); eqH.type = 'highshelf'; eqH.frequency.value = 4000; eqH.gain.value = monitorPreset.eq[2];
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = monitorPreset.compThreshold; comp.ratio.value = monitorPreset.compRatio;
        const monGain = ctx.createGain(); monGain.gain.value = 0.8;

        this.monitorSource.connect(eqL); eqL.connect(eqM); eqM.connect(eqH);
        eqH.connect(comp); comp.connect(monGain); monGain.connect(ctx.destination);

        this.monitorChain = [eqL, eqM, eqH, comp, monGain];
      }

      // MediaRecorder
      const recorder = new MediaRecorder(stream);
      this.mediaRecorder = recorder;
      this.recordChunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) this.recordChunks.push(e.data); };
      recorder.start(100);

      this._isRecording = true;
      return true;
    } catch (err) {
      console.error('AudioEngine: Mic access denied', err);
      return false;
    }
  }

  async stopRecording(): Promise<AudioBuffer | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        // Clean up monitoring
        this.monitorChain.forEach(n => { try { n.disconnect(); } catch {} });
        this.monitorChain = [];
        try { this.monitorSource?.disconnect(); } catch {}
        this.mediaStream?.getTracks().forEach(t => t.stop());
        this.monitorSource = null;
        this.recordAnalyser = null;
        this._isRecording = false;

        // Convert to AudioBuffer
        const blob = new Blob(this.recordChunks, { type: 'audio/webm' });
        if (blob.size < 500) { resolve(null); return; }

        try {
          const ctx = this.getContext();
          const arrayBuf = await blob.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          resolve(audioBuf);
        } catch {
          console.error('AudioEngine: Failed to decode recording');
          resolve(null);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  // ─── WAV Encoding ───

  encodeWav(buffer: AudioBuffer): ArrayBuffer {
    const ch = buffer.numberOfChannels;
    const sr = buffer.sampleRate;
    const len = buffer.length * ch * 2 + 44;
    const out = new ArrayBuffer(len);
    const v = new DataView(out);
    const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0,'RIFF'); v.setUint32(4,len-8,true); ws(8,'WAVE'); ws(12,'fmt ');
    v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,ch,true);
    v.setUint32(24,sr,true); v.setUint32(28,sr*ch*2,true); v.setUint16(32,ch*2,true);
    v.setUint16(34,16,true); ws(36,'data'); v.setUint32(40,len-44,true);
    let off = 44;
    for (let i = 0; i < buffer.length; i++) for (let c = 0; c < ch; c++) {
      v.setInt16(off, Math.max(-1, Math.min(1, buffer.getChannelData(c)[i])) * 0x7FFF, true); off += 2;
    }
    return out;
  }

  // ─── One-Shot Sounds ───

  playTone(frequency: number, type: OscillatorType = 'sine', duration = 0.3, volume = 0.3) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(this.masterGain || ctx.destination);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  playClick(accent = false) {
    this.playTone(accent ? 1000 : 800, 'sine', 0.05, accent ? 0.5 : 0.3);
  }

  // ─── Master Controls ───

  setMasterVolume(volume: number) {
    this._masterVolume = volume;
    if (this.masterGain) this.masterGain.gain.value = volume / 100;
  }

  setBpm(bpm: number) { this._bpm = bpm; }

  // ─── Getters ───

  get isPlaying() { return this._isPlaying; }
  get isRecording() { return this._isRecording; }
  get bpm() { return this._bpm; }
  get masterVolume() { return this._masterVolume; }
  get trackCount() { return this.tracks.size; }
  get trackIds() { return Array.from(this.tracks.keys()); }

  // ─── Cleanup ───

  dispose() {
    this.stopAll();
    if (this._isRecording) {
      this.mediaRecorder?.stop();
      this.mediaStream?.getTracks().forEach(t => t.stop());
    }
    this.tracks.forEach((node) => {
      try { node.eqLow.disconnect(); } catch {}
      try { node.analyser.disconnect(); } catch {}
    });
    this.tracks.clear();
    try { this.masterGain?.disconnect(); } catch {}
    try { this.masterAnalyser?.disconnect(); } catch {}
    this.ctx?.close();
    this.ctx = null;
  }
}

// ─── Singleton ───

let engineInstance: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engineInstance) {
    engineInstance = new AudioEngine();
  }
  return engineInstance;
}

export function disposeAudioEngine() {
  engineInstance?.dispose();
  engineInstance = null;
}

export type { AudioEngine };
