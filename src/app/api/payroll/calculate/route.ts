import { NextRequest, NextResponse } from 'next/server';
import { generateBatchFromPostgres } from '../../../../lib/payroll/server-engine';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'create');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 15, windowSeconds: 60, identifierPrefix: 'payroll-calculate' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { periodId, startDate, endDate, branchId, mentorIds, payrollPlanId, classPayrollPlanOverrides } = body;

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (!periodId || !startDate || !endDate || Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime()) || parsedStart > parsedEnd) {
      return NextResponse.json(
        { error: 'Valid periodId, startDate, and endDate are required, and startDate must not be after endDate.' },
        { status: 400 }
      );
    }
    if (classPayrollPlanOverrides !== undefined && (
      typeof classPayrollPlanOverrides !== 'object'
      || classPayrollPlanOverrides === null
      || Array.isArray(classPayrollPlanOverrides)
      || Object.values(classPayrollPlanOverrides).some((planId) => typeof planId !== 'string' || !planId)
    )) {
      return NextResponse.json({ error: 'classPayrollPlanOverrides must be a map of class IDs to payroll plan IDs.' }, { status: 400 });
    }

    const batch = await generateBatchFromPostgres({
      periodId,
      startDate,
      endDate,
      branchId,
      mentorIds,
      payrollPlanId,
      classPayrollPlanOverrides,
    });

    return NextResponse.json(batch);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
