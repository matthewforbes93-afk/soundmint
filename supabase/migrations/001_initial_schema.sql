-- Tracks table
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_name text not null,
  genre text not null,
  mood text not null,
  duration_seconds integer not null default 180,
  status text not null default 'generating' check (status in ('generating', 'ready', 'publishing', 'published', 'failed')),
  audio_url text,
  cover_art_url text,
  prompt text not null,
  ai_provider text not null default 'suno' check (ai_provider in ('suno', 'stable_audio', 'loudly', 'musicgen')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Distributions table
create table if not exists distributions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  platform text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'live', 'rejected', 'taken_down')),
  external_url text,
  distributor text not null default 'distrokid',
  submitted_at timestamptz not null default now(),
  live_at timestamptz
);

-- Stream stats table
create table if not exists stream_stats (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  platform text not null,
  streams integer not null default 0,
  estimated_revenue numeric(10,4) not null default 0,
  date date not null default current_date
);

-- Artist profiles table
create table if not exists artist_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bio text not null default '',
  image_url text,
  genre_focus text[] not null default '{}',
  total_tracks integer not null default 0,
  total_streams integer not null default 0,
  total_revenue numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_tracks_status on tracks(status);
create index if not exists idx_tracks_genre on tracks(genre);
create index if not exists idx_tracks_created on tracks(created_at desc);
create index if not exists idx_distributions_track on distributions(track_id);
create index if not exists idx_stream_stats_track on stream_stats(track_id);
create index if not exists idx_stream_stats_date on stream_stats(date);

-- Enable RLS
alter table tracks enable row level security;
alter table distributions enable row level security;
alter table stream_stats enable row level security;
alter table artist_profiles enable row level security;

-- Allow service role full access (for API routes)
create policy "Service role full access on tracks" on tracks for all using (true);
create policy "Service role full access on distributions" on distributions for all using (true);
create policy "Service role full access on stream_stats" on stream_stats for all using (true);
create policy "Service role full access on artist_profiles" on artist_profiles for all using (true);
