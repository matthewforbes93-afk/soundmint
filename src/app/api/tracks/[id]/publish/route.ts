import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { publishToDistroKid } from '@/lib/services/distributor';
import { DistributionPlatform } from '@/lib/types';
import { v4 as uuid } from 'uuid';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { platforms }: { platforms: DistributionPlatform[] } = await request.json();

  const { data: track, error } = await supabase.from('tracks').select('*').eq('id', id).single();
  if (error || !track) return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  if (track.status !== 'ready') {
    return NextResponse.json({ error: 'Track must be in ready state to publish' }, { status: 400 });
  }

  await supabase.from('tracks').update({ status: 'publishing', updated_at: new Date().toISOString() }).eq('id', id);

  try {
    const results = await publishToDistroKid({
      track,
      platforms,
      cover_art_url: track.cover_art_url || '',
    });

    for (const dist of results) {
      await supabase.from('distributions').insert({
        id: uuid(),
        track_id: id,
        platform: dist.platform,
        status: dist.status === 'submitted' ? 'processing' : 'rejected',
        external_url: null,
        distributor: 'distrokid',
        submitted_at: new Date().toISOString(),
        live_at: null,
      });
    }

    await supabase.from('tracks').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ results });
  } catch {
    await supabase.from('tracks').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ error: 'Publishing failed' }, { status: 500 });
  }
}
