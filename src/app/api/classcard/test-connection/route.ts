import { NextRequest, NextResponse } from 'next/server';
import { classcardClient } from '../../../../lib/integrations/classcard/client';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { authorizationErrorAsync } from '../../../../lib/auth/server';

export async function POST(req: NextRequest) {
  const denied = await authorizationErrorAsync(req, 'classcard_integration', 'manage_settings');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 20, windowSeconds: 60, identifierPrefix: 'classcard-test-connection' });
  if (rateLimitError) return rateLimitError;

  try {
    const result = await classcardClient.testConnection();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, message: `Connection test error: ${errorMsg}`, isMock: false },
      { status: 500 }
    );
  }
}
