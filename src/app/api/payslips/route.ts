import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { listPayslips } from '../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req);
  if (denied) return denied;
  const mentorId = req.nextUrl.searchParams.get('mentorId') || undefined;
  return NextResponse.json({ success: true, payslips: await listPayslips(mentorId) });
}
