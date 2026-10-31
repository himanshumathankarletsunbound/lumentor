import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { getMentorReview, listMentorReviews, listMentors, upsertMentorReview } from '../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'mentor_reviews', 'view');
  if (denied) return denied;
  try {
    const period = new URL(req.url).searchParams.get('period') || undefined;
    const user = await getSessionUserAsync(req);
    if (user?.role === 'MENTOR') {
      if (!user.mentorId) return NextResponse.json({ success: true, review: null });
      const review = await getMentorReview(user.mentorId, period);
      return NextResponse.json({
        success: true,
        review: review ? {
          reviewPeriod: review.reviewPeriod,
          auditScore: review.auditScore,
          operationScore: review.operationScore,
          totalScore: review.totalScore,
        } : null,
      });
    }
    const [reviews, mentors] = await Promise.all([listMentorReviews(period), listMentors()]);
    return NextResponse.json({ success: true, reviews, mentors });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load mentor reviews.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'mentor_reviews', 'edit');
  if (denied) return denied;
  try {
    const user = await getSessionUserAsync(req);
    if (!user || !['AUDIT', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Only the Audit Team can submit mentor reviews.' }, { status: 403 });
    }
    const body = await req.json();
    const mentorId = String(body.mentorId || '').trim();
    const reviewPeriod = String(body.reviewPeriod || '').trim();
    if (!mentorId || !reviewPeriod) {
      return NextResponse.json({ success: false, error: 'Mentor and review period are required.' }, { status: 400 });
    }
    if (body.auditScore === undefined || body.auditScore === '' || body.operationScore === undefined || body.operationScore === '') {
      return NextResponse.json({ success: false, error: 'Both Audit and Operations scores are required.' }, { status: 400 });
    }
    const reviewerRole = 'AUDIT' as const;
    const review = await upsertMentorReview({
      mentorId,
      reviewPeriod,
      auditScore: body.auditScore === undefined || body.auditScore === '' ? undefined : Number(body.auditScore),
      operationScore: body.operationScore === undefined || body.operationScore === '' ? undefined : Number(body.operationScore),
      auditComments: body.auditComments === undefined ? undefined : String(body.auditComments),
      operationComments: body.operationComments === undefined ? undefined : String(body.operationComments),
      reviewerId: user.id,
      reviewerRole,
    });
    return NextResponse.json({ success: true, review });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to save mentor review.' }, { status: 400 });
  }
}
