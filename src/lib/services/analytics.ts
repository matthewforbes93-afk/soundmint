import { DashboardStats, DistributionPlatform, Genre } from '../types';
import { createServerClient } from '../supabase';

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createServerClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [tracksRes, publishedRes, statsRes, monthTracksRes, monthRevenueRes] = await Promise.all([
    supabase.from('tracks').select('id', { count: 'exact', head: true }),
    supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('stream_stats').select('streams, estimated_revenue, platform'),
    supabase.from('tracks').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    supabase.from('stream_stats').select('estimated_revenue').gte('date', monthStart),
  ]);

  const allStats = statsRes.data || [];
  const totalStreams = allStats.reduce((sum, s) => sum + (s.streams || 0), 0);
  const totalRevenue = allStats.reduce((sum, s) => sum + (s.estimated_revenue || 0), 0);
  const monthRevenue = (monthRevenueRes.data || []).reduce((sum, s) => sum + (s.estimated_revenue || 0), 0);

  const platformStreams: Record<string, number> = {};
  allStats.forEach(s => {
    platformStreams[s.platform] = (platformStreams[s.platform] || 0) + s.streams;
  });
  const topPlatform = Object.entries(platformStreams).sort((a, b) => b[1] - a[1])[0]?.[0] as DistributionPlatform | undefined;

  const { data: genreData } = await supabase.from('tracks').select('genre').eq('status', 'published');
  const genreCounts: Record<string, number> = {};
  (genreData || []).forEach(t => {
    genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
  });
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as Genre | undefined;

  return {
    total_tracks: tracksRes.count || 0,
    published_tracks: publishedRes.count || 0,
    total_streams: totalStreams,
    total_revenue: totalRevenue,
    tracks_this_month: monthTracksRes.count || 0,
    revenue_this_month: monthRevenue,
    top_platform: topPlatform || null,
    top_genre: topGenre || null,
  };
}

export async function getRevenueByPlatform(): Promise<Record<DistributionPlatform, number>> {
  const supabase = createServerClient();
  const { data } = await supabase.from('stream_stats').select('platform, estimated_revenue');
  const result: Record<string, number> = {};
  (data || []).forEach(s => {
    result[s.platform] = (result[s.platform] || 0) + s.estimated_revenue;
  });
  return result as Record<DistributionPlatform, number>;
}

export async function getStreamsByDay(days: number = 30): Promise<{ date: string; streams: number; revenue: number }[]> {
  const supabase = createServerClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from('stream_stats')
    .select('date, streams, estimated_revenue')
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: true });

  const byDay: Record<string, { streams: number; revenue: number }> = {};
  (data || []).forEach(s => {
    if (!byDay[s.date]) byDay[s.date] = { streams: 0, revenue: 0 };
    byDay[s.date].streams += s.streams;
    byDay[s.date].revenue += s.estimated_revenue;
  });

  return Object.entries(byDay).map(([date, stats]) => ({ date, ...stats }));
}
