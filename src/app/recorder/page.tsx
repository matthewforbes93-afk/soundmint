'use client';

import { useState, useRef } from 'react';
import { Mic, Square, Play, Pause, Save, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RecorderPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function togglePlay() {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  }

  function discard() {
    setAudioUrl(null);
    setAudioBlob(null);
    setDuration(0);
    setTitle('');
  }

  async function saveRecording() {
    if (!audioBlob) return;
    setSaving(true);
    try {
      // Convert webm to a proper file
      const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

      // Upload directly via our API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || 'Untitled Recording');

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      toast.success('Recording saved to library!');
      setTitle('');
      setAudioUrl(null);
      setAudioBlob(null);
      setDuration(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Mic className="w-6 h-6 text-green-500" />
          Quick Recorder
        </h1>
        <p className="text-gray-400 text-sm mt-1">Capture ideas instantly — record, play back, save</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        {/* Recording Visualizer */}
        <div className="flex flex-col items-center mb-8">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 transition-all ${
            isRecording ? 'bg-red-500/20 animate-pulse ring-4 ring-red-500/30' : 'bg-gray-800'
          }`}>
            <Mic className={`w-12 h-12 ${isRecording ? 'text-red-400' : 'text-gray-500'}`} />
          </div>
          <p className="text-3xl font-mono text-white mb-2">{formatTime(duration)}</p>
          <p className="text-sm text-gray-500">
            {isRecording ? 'Recording...' : audioUrl ? 'Recording complete' : 'Ready to record'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {!isRecording && !audioUrl && (
            <button onClick={startRecording} className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white transition-colors">
              <Mic className="w-6 h-6" />
            </button>
          )}
          {isRecording && (
            <button onClick={stopRecording} className="w-16 h-16 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white transition-colors">
              <Square className="w-6 h-6" />
            </button>
          )}
          {audioUrl && !isRecording && (
            <>
              <button onClick={togglePlay} className="w-12 h-12 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center text-white">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button onClick={startRecording} className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white">
                <Mic className="w-5 h-5" />
              </button>
              <button onClick={discard} className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-gray-300">
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Save Section */}
        {audioUrl && !isRecording && (
          <div className="border-t border-gray-800 pt-6 space-y-4">
            <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name this idea..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={saveRecording} disabled={saving}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save to Library
              </button>
              <a href={audioUrl} download={`${title || 'recording'}.webm`}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-300 flex items-center gap-2">
                Download
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
