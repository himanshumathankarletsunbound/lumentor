import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db/store';
import { enforceRateLimit } from '../../../lib/rate-limit/limiter';
import { authorizationError } from '../../../lib/auth/server';

export async function GET(req: NextRequest) {
  const denied = authorizationError(req, 'penalties', 'view');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 60, windowSeconds: 60, identifierPrefix: 'penalties-get' });
  if (rateLimitError) return rateLimitError;

  const searchParams = req.nextUrl.searchParams;
  const mentorId = searchParams.get('mentorId') || undefined;
  const penalties = db.getPenalties(mentorId);
  return NextResponse.json(penalties);
}

export async function POST(req: NextRequest) {
  const denied = authorizationError(req, 'penalties', 'create');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 20, windowSeconds: 60, identifierPrefix: 'penalties-post' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { mentorId, branchId, category, reason, amount, evidenceNote, createdBy, createdByName } = body;

    if (!reason || !amount || !mentorId) {
      return NextResponse.json({ error: 'Missing mandatory fields' }, { status: 400 });
    }

    const mentor = db.getMentorById(mentorId);
    const branch = db.getBranchById(branchId);

    const pen = db.createPenalty({
      mentorId,
      mentorName: mentor ? `${mentor.firstName} ${mentor.lastName}` : 'Mentor',
      branchId: branchId || 'branch-nyc',
      branchName: branch?.name || 'Primary Campus',
      category: category || 'OTHER',
      reason,
      amount: parseFloat(amount),
      evidenceNote,
      createdBy: createdBy || 'system',
      createdByName: createdByName || 'Operations Staff',
    });

    return NextResponse.json(pen);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
