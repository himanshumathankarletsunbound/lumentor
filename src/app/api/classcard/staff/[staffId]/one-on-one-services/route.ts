import { NextRequest, NextResponse } from 'next/server';
import { classcardClient } from '../../../../../../lib/integrations/classcard/client';
import { authorizationError } from '../../../../../../lib/auth/server';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ staffId: string }> }
) {
  const denied = authorizationError(req, 'classcard_integration', 'view');
  if (denied) return denied;

  const { staffId } = await context.params;
  if (!staffId.trim()) {
    return NextResponse.json({ success: false, error: 'staffId is required.' }, { status: 400 });
  }

  const result = await classcardClient.getStaffOneOnOneServices(staffId);
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
