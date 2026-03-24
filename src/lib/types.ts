export type TrackStatus = 'generating' | 'ready' | 'publishing' | 'published' | 'failed';
export type Genre = 'lo-fi' | 'ambient' | 'jazz' | 'classical' | 'electronic' | 'hip-hop' | 'rap' | 'trap' | 'drill' | 'pop' | 'r&b' | 'rock' | 'latin' | 'reggaeton' | 'afrobeat' | 'dancehall' | 'country' | 'gospel' | 'soul' | 'funk' | 'meditation' | 'cinematic';
export type Mood = 'chill' | 'energetic' | 'melancholic' | 'uplifting' | 'dark' | 'peaceful' | 'romantic' | 'epic' | 'dreamy' | 'aggressive';
export type DistributionPlatform = 'spotify' | 'apple_music' | 'amazon_music' | 'youtube_music' | 'tiktok' | 'deezer' | 'tidal';

export interface Track {
  id: string;
  title: string;
  artist_name: string;
  genre: Genre;
  mood: Mood;
  duration_seconds: number;
  status: TrackStatus;
  audio_url: string | null;
  cover_art_url: string | null;
  prompt: string;
  ai_provider: 'suno' | 'stable_audio' | 'loudly' | 'musicgen';
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Distribution {
  id: string;
  track_id: string;
  platform: DistributionPlatform;
  status: 'pending' | 'processing' | 'live' | 'rejected' | 'taken_down';
  external_url: string | null;
  distributor: 'distrokid' | 'tunecore';
  submitted_at: string;
  live_at: string | null;
}

export interface StreamStats {
  id: string;
  track_id: string;
  platform: DistributionPlatform;
  streams: number;
  estimated_revenue: number;
  date: string;
}

export interface ArtistProfile {
  id: string;
  name: string;
  bio: string;
  image_url: string | null;
  genre_focus: Genre[];
  total_tracks: number;
  total_streams: number;
  total_revenue: number;
  created_at: string;
}

export interface GenerationRequest {
  genre: Genre;
  mood: Mood;
  prompt: string;
  duration?: number;
  with_vocals?: boolean;
  lyrics?: string;
  artist_name: string;
  auto_publish?: boolean;
  platforms?: DistributionPlatform[];
  ai_provider?: Track['ai_provider'];
}

export interface DashboardStats {
  total_tracks: number;
  published_tracks: number;
  total_streams: number;
  total_revenue: number;
  tracks_this_month: number;
  revenue_this_month: number;
  top_platform: DistributionPlatform | null;
  top_genre: Genre | null;
}
