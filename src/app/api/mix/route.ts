export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { stems, format = 'mp3', master = true, track_id } = body;

  if (!stems || Object.keys(stems).length === 0) {
    return NextResponse.json({ error: 'No stems provided' }, { status: 400 });
  }

  const localUrl = process.env.MUSICGEN_LOCAL_URL || 'http://localhost:8501';

  try {
    const response = await fetch(`${localUrl}/mix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stems, format, master }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Mix failed: ${err}` }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();

    // Upload mixed file to Supabase
    const supabase = createServerClient();
    const ext = format === 'mp3' ? 'mp3' : 'wav';
    const filename = `mixes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filename, Buffer.from(audioBuffer), {
        contentType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filename);

    // Update track if track_id provided
    if (track_id) {
      await supabase.from('tracks').update({
        audio_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', track_id);
    }

    return NextResponse.json({
      audio_url: urlData.publicUrl,
      format: ext,
      mastered: master,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Mix failed',
    }, { status: 500 });
  }
}
