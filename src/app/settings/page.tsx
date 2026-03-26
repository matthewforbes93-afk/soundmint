'use client';

import { useState } from 'react';
import { Settings, Key, Volume2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    sunoKey: '', stableAudioKey: '', loudlyKey: '', openaiKey: '', distrokidKey: '',
    defaultArtist: '', defaultGenre: 'hip-hop', bufferSize: '512', sampleRate: '44100',
  });

  function handleSave() {
    localStorage.setItem('soundmint_settings', JSON.stringify(settings));
    toast.success('Settings saved');
  }

  const inputClass = 'w-full bg-white/[0.03] border border-white/[0.04] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-800 focus:outline-none focus:border-teal-500/30';
  const labelClass = 'text-[11px] text-gray-500 mb-1 block';

  return (
    <div className="h-full flex">
      {/* Left: nav */}
      <div className="w-56 border-r border-white/[0.03] p-4">
        <h2 className="text-xs text-gray-600 uppercase tracking-wider mb-4">Settings</h2>
        {['API Keys', 'Audio', 'Default Profile'].map(section => (
          <div key={section} className="px-3 py-2 text-xs text-gray-500 hover:text-white hover:bg-white/[0.02] rounded-lg cursor-pointer transition-colors">
            {section}
          </div>
        ))}
      </div>

      {/* Right: settings */}
      <div className="flex-1 p-6 overflow-auto max-w-xl">
        {/* API Keys */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Key className="w-4 h-4 text-teal-500" /> API Keys
          </h3>
          <div className="space-y-3">
            {[
              { key: 'sunoKey', label: 'Suno API Key', placeholder: 'sk-...' },
              { key: 'openaiKey', label: 'OpenAI (Cover Art)', placeholder: 'sk-...' },
              { key: 'distrokidKey', label: 'DistroKid', placeholder: 'dk-...' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <input type="password" value={(settings as Record<string, string>)[key]}
                  onChange={e => setSettings({ ...settings, [key]: e.target.value })}
                  placeholder={placeholder} className={inputClass} />
              </div>
            ))}
          </div>
        </div>

        {/* Audio */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Volume2 className="w-4 h-4 text-teal-500" /> Audio
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Buffer Size</label>
              <select value={settings.bufferSize} onChange={e => setSettings({ ...settings, bufferSize: e.target.value })} className={inputClass}>
                {['128', '256', '512', '1024', '2048'].map(v => <option key={v} value={v}>{v} samples</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sample Rate</label>
              <select value={settings.sampleRate} onChange={e => setSettings({ ...settings, sampleRate: e.target.value })} className={inputClass}>
                {['44100', '48000', '96000'].map(v => <option key={v} value={v}>{parseInt(v)/1000}kHz</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Default Profile */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-teal-500" /> Defaults
          </h3>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Default Artist Name</label>
              <input type="text" value={settings.defaultArtist} onChange={e => setSettings({ ...settings, defaultArtist: e.target.value })}
                placeholder="Your artist name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Default Genre</label>
              <select value={settings.defaultGenre} onChange={e => setSettings({ ...settings, defaultGenre: e.target.value })} className={inputClass}>
                {['hip-hop', 'rap', 'trap', 'pop', 'r&b', 'electronic', 'lo-fi', 'jazz', 'rock', 'latin', 'afrobeat'].map(g =>
                  <option key={g} value={g}>{g}</option>
                )}
              </select>
            </div>
          </div>
        </div>

        <button onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm text-white font-medium transition-colors">
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </div>
    </div>
  );
}
