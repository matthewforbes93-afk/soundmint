export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const localUrl = process.env.MUSICGEN_LOCAL_URL || 'http://localhost:8501';

  try {
    const analyzeForm = new FormData();
    analyzeForm.append('file', file);

    const response = await fetch(`${localUrl}/analyze`, {
      method: 'POST',
      body: analyzeForm,
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Analysis failed: ${err}` }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Analysis failed',
    }, { status: 500 });
  }
}
