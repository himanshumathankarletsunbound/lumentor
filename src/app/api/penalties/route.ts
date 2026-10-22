import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '../../../lib/rate-limit/limiter';
import { authorizationErrorAsync } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { createPenalty, listPenalties } from '../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'penalties', 'view');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 60, windowSeconds: 60, identifierPrefix: 'penalties-get' });
  if (rateLimitError) return rateLimitError;

  const searchParams = req.nextUrl.searchParams;
  const mentorId = searchParams.get('mentorId') || undefined;
  const penalties = await listPenalties(mentorId);
  return NextResponse.json(penalties);
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'penalties', 'create');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 20, windowSeconds: 60, identifierPrefix: 'penalties-post' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { mentorId, branchId, category, reason, amount, evidenceNote, createdBy } = body;

    if (!reason || !amount || !mentorId || !branchId) {
      return NextResponse.json({ error: 'Missing mandatory fields' }, { status: 400 });
    }

    const pen = await createPenalty({
      mentorId,
      branchId,
      category: category || 'OTHER',
      reason,
      amount: parseFloat(amount),
      evidenceNote,
      createdBy: createdBy || 'system',
      classId: body.classId,
    });
    return NextResponse.json(pen);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
