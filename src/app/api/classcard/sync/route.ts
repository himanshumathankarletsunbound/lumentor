import { NextRequest, NextResponse } from 'next/server';
import { runClasscardSync } from '../../../../lib/integrations/classcard/sync';
import { SyncJobType } from '../../../../lib/types/classcard';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { authorizationErrorAsync } from '../../../../lib/auth/server';

export async function POST(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, { limit: 12, windowSeconds: 60, identifierPrefix: 'classcard-sync' });
  if (rateLimitError) return rateLimitError;

  try {
    const denied = await authorizationErrorAsync(req, 'classcard_integration', 'manage_settings');
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const jobType: SyncJobType = body.jobType || 'ALL';
    const job = await runClasscardSync(jobType);
    return NextResponse.json(job);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
