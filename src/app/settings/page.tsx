'use client';

import { useState } from 'react';
import { Settings, Key, User, Globe, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    suno_api_key: '',
    stable_audio_key: '',
    loudly_api_key: '',
    openai_api_key: '',
    distrokid_api_key: '',
    default_artist: '',
    default_genre: 'lo-fi',
    default_provider: 'suno',
    auto_cover_art: true,
    auto_publish: false,
  });

  function handleSave() {
    localStorage.setItem('jukebox_settings', JSON.stringify(settings));
    toast.success('Settings saved');
  }

  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Settings className="w-6 h-6 text-purple-500" />
          Settings
        </h1>
        <p className="text-gray-400 text-sm mt-1">Configure your AI music pipeline</p>
      </div>

      <div className="space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-purple-500" />
            API Keys
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Suno API Key</label>
              <input type="password" value={settings.suno_api_key} onChange={(e) => setSettings({ ...settings, suno_api_key: e.target.value })} placeholder="sk-..." className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Stable Audio API Key</label>
              <input type="password" value={settings.stable_audio_key} onChange={(e) => setSettings({ ...settings, stable_audio_key: e.target.value })} placeholder="sk-..." className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Loudly API Key</label>
              <input type="password" value={settings.loudly_api_key} onChange={(e) => setSettings({ ...settings, loudly_api_key: e.target.value })} placeholder="sk-..." className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>OpenAI API Key (Cover Art)</label>
              <input type="password" value={settings.openai_api_key} onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })} placeholder="sk-..." className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>DistroKid API Key</label>
              <input type="password" value={settings.distrokid_api_key} onChange={(e) => setSettings({ ...settings, distrokid_api_key: e.target.value })} placeholder="dk-..." className={inputClass} />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-purple-500" />
            Default Artist Profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Artist Name</label>
              <input type="text" value={settings.default_artist} onChange={(e) => setSettings({ ...settings, default_artist: e.target.value })} placeholder="e.g., Luna Waves" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Default Genre</label>
              <select value={settings.default_genre} onChange={(e) => setSettings({ ...settings, default_genre: e.target.value })} className={inputClass}>
                {['lo-fi', 'ambient', 'jazz', 'classical', 'electronic', 'hip-hop', 'pop', 'cinematic', 'meditation'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Default AI Provider</label>
              <select value={settings.default_provider} onChange={(e) => setSettings({ ...settings, default_provider: e.target.value })} className={inputClass}>
                <option value="suno">Suno</option>
                <option value="stable_audio">Stable Audio</option>
                <option value="loudly">Loudly</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-purple-500" />
            Distribution Preferences
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, auto_cover_art: !settings.auto_cover_art })}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.auto_cover_art ? 'bg-purple-600' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settings.auto_cover_art ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-sm text-gray-300">Auto-generate cover art with DALL-E</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, auto_publish: !settings.auto_publish })}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.auto_publish ? 'bg-purple-600' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settings.auto_publish ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-sm text-gray-300">Auto-publish all generated tracks</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
}
