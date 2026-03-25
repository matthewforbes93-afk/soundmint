export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { trackUrls, format = 'mp3', master = true, title = 'Untitled' } = await request.json();

  if (!trackUrls?.length) {
    return NextResponse.json({ error: 'No tracks to export' }, { status: 400 });
  }

  const localUrl = process.env.MUSICGEN_LOCAL_URL || 'http://localhost:8501';

  try {
    // Download all track audio and convert to base64
    const stems: Record<string, unknown> = {};
    for (let i = 0; i < trackUrls.length; i++) {
      const { url, name, volume, pan, mute } = trackUrls[i];
      if (mute || !url) continue;

      const audioRes = await fetch(url);
      const blob = await audioRes.blob();
      const buffer = await blob.arrayBuffer();
      const b64 = Buffer.from(buffer).toString('base64');

      stems[name || `track_${i}`] = {
        data: b64,
        format: url.endsWith('.mp3') ? 'mp3' : 'wav',
        volume: volume || 0,
        pan: pan || 0,
        mute: false,
      };
    }

    if (Object.keys(stems).length === 0) {
      return NextResponse.json({ error: 'No audible tracks to export' }, { status: 400 });
    }

    // Mix via local server
    const mixRes = await fetch(`${localUrl}/mix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stems, format, master }),
    });

    if (!mixRes.ok) {
      // Fallback: just return the first track
      const firstUrl = trackUrls.find((t: { url: string; mute: boolean }) => t.url && !t.mute)?.url;
      if (firstUrl) {
        return NextResponse.json({ audio_url: firstUrl, format: 'original' });
      }
      return NextResponse.json({ error: 'Mix failed' }, { status: 500 });
    }

    const audioBuffer = await mixRes.arrayBuffer();

    // Upload to Supabase
    const supabase = createServerClient();
    const ext = format === 'mp3' ? 'mp3' : 'wav';
    const filename = `exports/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filename, Buffer.from(audioBuffer), {
        contentType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filename);

    // Create a track record for the export
    const { v4: uuid } = await import('uuid');
    await supabase.from('tracks').insert({
      id: uuid(),
      title: `${title} (Export)`,
      artist_name: 'Me',
      genre: 'lo-fi',
      mood: 'chill',
      duration_seconds: 0,
      status: 'ready',
      audio_url: urlData.publicUrl,
      cover_art_url: null,
      prompt: 'studio export',
      ai_provider: 'musicgen',
      external_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      audio_url: urlData.publicUrl,
      format: ext,
      mastered: master,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Export failed',
    }, { status: 500 });
  }
}
