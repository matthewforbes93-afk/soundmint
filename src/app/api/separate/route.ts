export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const trackId = formData.get('track_id') as string | null;
  const format = (formData.get('format') as string) || 'wav';

  if (!file && !trackId) {
    return NextResponse.json({ error: 'Provide a file or track_id' }, { status: 400 });
  }

  const localUrl = process.env.MUSICGEN_LOCAL_URL || 'http://localhost:8501';

  try {
    let audioFile = file;

    // If track_id provided, download from Supabase
    if (!audioFile && trackId) {
      const supabase = createServerClient();
      const { data: track } = await supabase.from('tracks').select('audio_url').eq('id', trackId).single();
      if (!track?.audio_url) {
        return NextResponse.json({ error: 'Track not found or no audio' }, { status: 404 });
      }
      const audioRes = await fetch(track.audio_url);
      const blob = await audioRes.blob();
      audioFile = new File([blob], 'track.mp3', { type: blob.type });
    }

    // Send to local server for separation
    const sepForm = new FormData();
    sepForm.append('file', audioFile!);
    sepForm.append('format', format);

    const response = await fetch(`${localUrl}/separate`, {
      method: 'POST',
      body: sepForm,
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Separation failed: ${err}` }, { status: 500 });
    }

    const result = await response.json();

    // Upload stems to Supabase Storage
    const supabase = createServerClient();
    const stemUrls: Record<string, string> = {};

    for (const [stemName, stemData] of Object.entries(result.stems)) {
      const stem = stemData as { data: string; format: string };
      const buffer = Buffer.from(stem.data, 'base64');
      const ext = stem.format;
      const filename = `stems/${trackId || Date.now()}/${stemName}.${ext}`;

      await supabase.storage.from('audio').upload(filename, buffer, {
        contentType: ext === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        upsert: true,
      });

      const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filename);
      stemUrls[stemName] = urlData.publicUrl;
    }

    return NextResponse.json({
      stems: stemUrls,
      stem_names: result.stem_names,
      duration_ms: result.duration_ms,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Separation failed',
    }, { status: 500 });
  }
}
