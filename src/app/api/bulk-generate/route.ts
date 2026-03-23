import { NextRequest, NextResponse } from 'next/server';
import { GenerationRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  const { requests, auto_publish, platforms }: {
    requests: GenerationRequest[];
    auto_publish: boolean;
    platforms: string[];
  } = await request.json();

  if (!requests?.length) {
    return NextResponse.json({ error: 'No generation requests provided' }, { status: 400 });
  }

  if (requests.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 tracks per batch' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const results = await Promise.allSettled(
    requests.map(req =>
      fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, auto_publish, platforms }),
      }).then(r => r.json())
    )
  );

  const created = results
    .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === 'fulfilled')
    .map(r => r.value);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').length;

  return NextResponse.json({ created: created.length, failed, tracks: created }, { status: 201 });
}
