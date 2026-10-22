import { NextRequest, NextResponse } from 'next/server';
import { authorizationError } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { db } from '../../../lib/db/store';

const allowedTypes = ['mentor', 'student', 'branch', 'subject', 'package'] as const;
type RecordType = (typeof allowedTypes)[number];

export async function POST(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = authorizationError(req);
    if (denied) return denied;

    const body = await req.json() as { type?: RecordType; record?: Record<string, unknown> };
    if (!body.type || !allowedTypes.includes(body.type) || !body.record) {
      return NextResponse.json({ success: false, error: 'A valid record type and record are required.' }, { status: 400 });
    }

    const record = body.record;
    let created: unknown;
    switch (body.type) {
      case 'mentor':
        created = db.createMentor(record as Parameters<typeof db.createMentor>[0]);
        break;
      case 'student':
        created = db.createStudent(record as Parameters<typeof db.createStudent>[0]);
        break;
      case 'branch':
        created = db.createBranch(record as Parameters<typeof db.createBranch>[0]);
        break;
      case 'subject':
        created = db.createSubject(record as Parameters<typeof db.createSubject>[0]);
        break;
      case 'package':
        created = db.createPackage(record as Parameters<typeof db.createPackage>[0]);
        break;
    }
    await db.persistNow();
    return NextResponse.json({ success: true, record: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create record.' },
      { status: 500 }
    );
  }
}
