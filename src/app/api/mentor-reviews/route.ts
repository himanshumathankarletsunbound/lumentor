import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { getMentorReview, listMentorReviews, listMentors, upsertMentorReview } from '../../../lib/db/state-repository';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'mentor_reviews', 'view');
  if (denied) return denied;
  try {
    const period = new URL(req.url).searchParams.get('period') || undefined;
    const allPeriods = new URL(req.url).searchParams.get('all') === 'true';
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
    const [reviews, mentors] = await Promise.all([listMentorReviews(allPeriods ? undefined : period), listMentors()]);
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
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const reviewPeriod = String(form.get('reviewPeriod') || '').trim();
      if (!(file instanceof File) || !/\.(csv|xlsx|xls)$/i.test(file.name)) {
        return NextResponse.json({ success: false, error: 'Upload a CSV or Excel (.xlsx/.xls) rating sheet.' }, { status: 400 });
      }
      if (!reviewPeriod) return NextResponse.json({ success: false, error: 'Review period is required.' }, { status: 400 });
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const mentors = await listMentors();
      const mentorById = new Map(mentors.filter((mentor) => mentor.status === 'ACTIVE').map((mentor) => [mentor.id, mentor]));
      if (!rows.length) throw new Error('The rating sheet must contain at least one mentor row.');
      const ratings = [];
      const seenMentorIds = new Set<string>();
      for (const [index, row] of rows.entries()) {
        const normalized = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), String(value).trim()]));
        const mentorId = normalized.get('mentorid') || '';
        const mentor = mentorById.get(mentorId);
        if (!mentor) throw new Error(`Row ${index + 2}: active mentor ID "${mentorId}" was not found.`);
        if (seenMentorIds.has(mentorId)) throw new Error(`Row ${index + 2}: mentor ID "${mentorId}" appears more than once.`);
        seenMentorIds.add(mentorId);
        const auditScore = Number(normalized.get('auditrating') || normalized.get('auditscore') || '');
        if (!Number.isFinite(auditScore) || auditScore < 0 || auditScore > 3) throw new Error(`Row ${index + 2}: Audit rating must be between 0 and 3.`);
        const operationScore = Number(normalized.get('operationsrating') || normalized.get('operationsscore') || '2');
        if (!Number.isFinite(operationScore) || operationScore < 0 || operationScore > 2) throw new Error(`Row ${index + 2}: Operations rating must be between 0 and 2.`);
        ratings.push({ mentorId, auditScore, operationScore, comments: normalized.get('remark') || null });
      }
      return NextResponse.json({ success: true, staged: ratings.length, ratings });
    }
    const body = await req.json();
    if (Array.isArray(body.ratings)) {
      const reviewPeriod = String(body.reviewPeriod || '').trim();
      if (!reviewPeriod) throw new Error('Review period is required.');
      const saved = [];
      const seenMentorIds = new Set<string>();
      for (const rating of body.ratings) {
        const mentorId = String(rating.mentorId || '').trim();
        const auditScore = Number(rating.auditScore);
        const operationScore = Number(rating.operationScore);
        if (!mentorId || !Number.isFinite(auditScore) || auditScore < 0 || auditScore > 3 || !Number.isFinite(operationScore) || operationScore < 0 || operationScore > 2) throw new Error('Every rating must include valid Audit (0-3) and Operations (0-2) scores.');
        if (seenMentorIds.has(mentorId)) throw new Error(`Mentor ID "${mentorId}" appears more than once.`);
        seenMentorIds.add(mentorId);
        saved.push(await upsertMentorReview({ mentorId, reviewPeriod, auditScore, operationScore, auditComments: rating.comments || null, operationComments: rating.comments || null, reviewerId: user.id, reviewerRole: 'AUDIT' }));
      }
      return NextResponse.json({ success: true, submitted: saved.length, reviews: saved });
    }
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
