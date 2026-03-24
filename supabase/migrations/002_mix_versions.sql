-- Mix version history for the Studio
create table if not exists mix_versions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  name text not null,
  mix_settings jsonb not null default '{}',
  audio_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mix_versions_track on mix_versions(track_id);
alter table mix_versions enable row level security;
create policy "Service role full access on mix_versions" on mix_versions for all using (true);
