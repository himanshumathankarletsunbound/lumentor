import { NextRequest, NextResponse } from 'next/server';
import { payrollEngine } from '../../../../lib/payroll/engine';
import { db } from '../../../../lib/db/store';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { authorizationError } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = authorizationError(req, 'payroll_processing', 'create');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 15, windowSeconds: 60, identifierPrefix: 'payroll-calculate' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { periodId, startDate, endDate, branchId, mentorIds } = body;

    if (!periodId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: periodId, startDate, endDate' },
        { status: 400 }
      );
    }

    const batch = payrollEngine.generateBatch({
      periodId,
      startDate,
      endDate,
      branchId,
      mentorIds,
    });

    await db.persistNow();
    return NextResponse.json(batch);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
