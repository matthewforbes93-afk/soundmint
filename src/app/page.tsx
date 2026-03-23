'use client';

import { useEffect, useState } from 'react';
import { DashboardStats, Track } from '@/lib/types';
import StatsCard from '@/components/StatsCard';
import TrackCard from '@/components/TrackCard';
import { Music, Upload, BarChart3, DollarSign, TrendingUp, Disc3 } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [streamsByDay, setStreamsByDay] = useState<{ date: string; streams: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, tracksRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/tracks?limit=5'),
        ]);
        const statsData = await statsRes.json();
        const tracksData = await tracksRes.json();
        setStats(statsData.stats);
        setStreamsByDay(statsData.streamsByDay || []);
        setRecentTracks(Array.isArray(tracksData) ? tracksData.slice(0, 5) : []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Your AI music empire at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="Total Tracks" value={stats?.total_tracks || 0} icon={Music} color="purple" />
        <StatsCard label="Published" value={stats?.published_tracks || 0} icon={Upload} color="green" />
        <StatsCard label="Total Streams" value={stats?.total_streams?.toLocaleString() || '0'} icon={BarChart3} color="blue" />
        <StatsCard label="Total Revenue" value={`$${(stats?.total_revenue || 0).toFixed(2)}`} icon={DollarSign} color="yellow" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatsCard label="Tracks This Month" value={stats?.tracks_this_month || 0} icon={TrendingUp} color="pink" />
        <StatsCard label="Revenue This Month" value={`$${(stats?.revenue_this_month || 0).toFixed(2)}`} icon={DollarSign} color="green" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Revenue & Streams (30 Days)</h2>
        {streamsByDay.length > 0 ? (
          <div className="flex items-end gap-1 h-40">
            {streamsByDay.map((day, i) => {
              const maxStreams = Math.max(...streamsByDay.map(d => d.streams), 1);
              const height = (day.streams / maxStreams) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-purple-600 rounded-t"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${day.date}: ${day.streams} streams, $${day.revenue.toFixed(2)}`}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-500">
            <p>No streaming data yet. Publish tracks to start earning!</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Tracks</h2>
        {recentTracks.length > 0 ? (
          <div className="grid gap-3">
            {recentTracks.map((track) => <TrackCard key={track.id} track={track} />)}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <Music className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400">No tracks yet. Start generating!</p>
          </div>
        )}
      </div>
    </div>
  );
}
