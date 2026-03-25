'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardStats, Track } from '@/lib/types';
import StatsCard from '@/components/StatsCard';
import TrackCard from '@/components/TrackCard';
import { Music, Upload, BarChart3, DollarSign, Wand2, Sliders, Mic, Library, Disc3, Zap } from 'lucide-react';

const quickActions = [
  { href: '/studio', label: 'Open Studio', desc: 'Full DAW — compose, record, mix, master', icon: Sliders, color: 'from-teal-600 to-emerald-600' },
  { href: '/recorder', label: 'Quick Record', desc: 'Capture an idea instantly', icon: Mic, color: 'from-emerald-600 to-green-600' },
  { href: '/marketplace', label: 'Marketplace', desc: 'Sell beats & license tracks', icon: DollarSign, color: 'from-violet-600 to-purple-600' },
  { href: '/collaborate', label: 'Collaborate', desc: 'Share sessions & invite artists', icon: Library, color: 'from-cyan-600 to-teal-600' },
];

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, tracksRes] = await Promise.all([
          fetch('/api/stats').then(r => r.json()).catch(() => ({})),
          fetch('/api/tracks').then(r => r.json()).catch(() => []),
        ]);
        setStats(statsRes.stats || null);
        setRecentTracks(Array.isArray(tracksRes) ? tracksRes.slice(0, 4) : []);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Disc3 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome to <span className="bg-gradient-to-r from-teal-400 to-emerald-300 bg-clip-text text-transparent">SoundMint</span>
        </h1>
        <p className="text-gray-400">Your all-in-one music production studio. Create, produce, distribute.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {quickActions.map(({ href, label, desc, icon: Icon, color }) => (
          <Link key={href} href={href}
            className="group bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all hover:scale-[1.02]">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">{label}</h3>
            <p className="text-xs text-gray-500 mt-1">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="Total Tracks" value={stats?.total_tracks || 0} icon={Music} color="purple" />
        <StatsCard label="Published" value={stats?.published_tracks || 0} icon={Upload} color="green" />
        <StatsCard label="Total Streams" value={stats?.total_streams?.toLocaleString() || '0'} icon={BarChart3} color="blue" />
        <StatsCard label="Revenue" value={`$${(stats?.total_revenue || 0).toFixed(2)}`} icon={DollarSign} color="yellow" />
      </div>

      {/* Recent Tracks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Tracks</h2>
          <Link href="/library" className="text-sm text-purple-400 hover:text-purple-300">View all</Link>
        </div>
        {recentTracks.length > 0 ? (
          <div className="grid gap-3">
            {recentTracks.map((track) => <TrackCard key={track.id} track={track} />)}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <Zap className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No tracks yet. Start creating!</p>
            <div className="flex gap-3 justify-center">
              <Link href="/playground" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white">
                AI Generate
              </Link>
              <Link href="/recorder" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-300">
                Record
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
