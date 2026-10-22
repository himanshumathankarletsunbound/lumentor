import { NextRequest, NextResponse } from 'next/server';
import { authorizationError } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { db } from '../../../lib/db/store';
import { saveNormalizedRecord, deleteNormalizedRecord } from '../../../lib/db/state-repository';
import { listBranches, listMentors, listPackages, listStudents, listSubjects } from '../../../lib/db/state-repository';

const allowedTypes = ['mentor', 'student', 'branch', 'subject', 'package'] as const;
type RecordType = (typeof allowedTypes)[number];

export async function GET(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = authorizationError(req);
    if (denied) return denied;

    const type = new URL(req.url).searchParams.get('type') as RecordType | null;
    if (!type || !allowedTypes.includes(type)) {
      return NextResponse.json({ success: false, error: 'A valid record type is required.' }, { status: 400 });
    }

    const records = type === 'mentor'
      ? await listMentors()
      : type === 'student'
      ? await listStudents()
      : type === 'branch'
      ? await listBranches()
      : type === 'subject'
      ? await listSubjects()
      : await listPackages();

    return NextResponse.json({ success: true, records });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load records.' },
      { status: 500 }
    );
  }
}

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
    if (process.env.DEMO_MODE !== 'true') {
      await saveNormalizedRecord(body.type, created as never, db.getSnapshot());
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

export async function PUT(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = authorizationError(req);
    if (denied) return denied;

    const body = (await req.json()) as {
      type?: RecordType;
      id?: string;
      updates?: Record<string, unknown>;
    };
    if (!body.type || !allowedTypes.includes(body.type) || !body.id || !body.updates) {
      return NextResponse.json(
        { success: false, error: 'A valid record type, id, and updates object are required.' },
        { status: 400 }
      );
    }

    let updated: unknown;
    switch (body.type) {
      case 'mentor':
        updated = db.updateMentor(body.id, body.updates as Parameters<typeof db.updateMentor>[1]);
        break;
      case 'student':
        updated = db.updateStudent(body.id, body.updates as Parameters<typeof db.updateStudent>[1]);
        break;
      case 'branch':
        updated = db.updateBranch(body.id, body.updates as Parameters<typeof db.updateBranch>[1]);
        break;
      case 'subject':
        updated = db.updateSubject(body.id, body.updates as Parameters<typeof db.updateSubject>[1]);
        break;
      case 'package':
        updated = db.updatePackage(body.id, body.updates as Parameters<typeof db.updatePackage>[1]);
        break;
    }

    if (process.env.DEMO_MODE !== 'true') {
      try {
        await saveNormalizedRecord(body.type, updated as never, db.getSnapshot());
      } catch (err) {
        console.warn('Prisma save error during update:', err);
      }
    }
    await db.persistNow();
    return NextResponse.json({ success: true, record: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update record.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = authorizationError(req);
    if (denied) return denied;

    const url = new URL(req.url);
    const type = url.searchParams.get('type') as RecordType | null;
    const id = url.searchParams.get('id');

    if (!type || !allowedTypes.includes(type) || !id) {
      return NextResponse.json(
        { success: false, error: 'A valid record type and record id are required.' },
        { status: 400 }
      );
    }

    let deleted = false;
    switch (type) {
      case 'mentor':
        deleted = db.deleteMentor(id);
        break;
      case 'student':
        deleted = db.deleteStudent(id);
        break;
      case 'branch':
        deleted = db.deleteBranch(id);
        break;
      case 'subject':
        deleted = db.deleteSubject(id);
        break;
      case 'package':
        deleted = db.deletePackage(id);
        break;
    }

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: `Record not found or could not be deleted.` },
        { status: 404 }
      );
    }

    if (process.env.DEMO_MODE !== 'true') {
      try {
        await deleteNormalizedRecord(type, id);
      } catch (err) {
        console.warn('Prisma delete error:', err);
      }
    }
    await db.persistNow();
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete record.' },
      { status: 500 }
    );
  }
}
