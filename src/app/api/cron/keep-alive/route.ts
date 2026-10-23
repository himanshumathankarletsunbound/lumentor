import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      success: true,
      database: 'reachable',
      checkedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Database keep-alive failed:', error);
    return NextResponse.json(
      { success: false, error: 'Database health check failed.' },
      { status: 503 }
    );
  }
}
