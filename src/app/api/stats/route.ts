import { NextResponse } from 'next/server';
import { getDashboardStats, getRevenueByPlatform, getStreamsByDay } from '@/lib/services/analytics';

export async function GET() {
  try {
    const [stats, revenueByPlatform, streamsByDay] = await Promise.all([
      getDashboardStats(),
      getRevenueByPlatform(),
      getStreamsByDay(30),
    ]);

    return NextResponse.json({ stats, revenueByPlatform, streamsByDay });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
