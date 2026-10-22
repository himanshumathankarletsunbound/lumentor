import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { saveNormalizedRecord } from '../../../../lib/db/state-repository';
import { db } from '../../../../lib/db/store';

interface StaffImportRow {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || 'Unknown', lastName: parts.join(' ') || 'Staff' };
}

export async function POST(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = await authorizationErrorAsync(req, 'settings', 'manage_settings');
    if (denied) return denied;

    const body = await req.json() as { rows?: StaffImportRow[] };
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one staff row is required.' }, { status: 400 });
    }

    const branch = db.getBranches()[0];
    const payrollPlan = db.getPayrollPlans()[0];
    if (!branch || !payrollPlan) {
      return NextResponse.json(
        { success: false, error: 'Create at least one campus branch and payroll plan before importing staff.' },
        { status: 400 }
      );
    }

    const uniqueRows = new Map<string, StaffImportRow>();
    for (const row of body.rows) {
      const email = String(row.email || '').trim().toLowerCase();
      const name = String(row.name || '').trim();
      if (email && name) uniqueRows.set(email, { ...row, email, name });
    }

    let created = 0;
    let updated = 0;
    for (const row of uniqueRows.values()) {
      const email = String(row.email);
      const { firstName, lastName } = splitName(String(row.name));
      const existing = db.getMentorByEmail(email);
      const mentor = existing
        ? db.updateMentor(existing.id, {
            firstName,
            lastName,
            phone: String(row.phone || '').trim(),
            branchId: branch.id,
            branchName: branch.name,
            payrollPlanId: payrollPlan.id,
            status: 'ACTIVE',
            provenance: 'CLASSCARD_SOURCED',
          })
        : db.createMentor({
            firstName,
            lastName,
            email,
            phone: String(row.phone || '').trim(),
            branchId: branch.id,
            branchName: branch.name,
            subjectIds: [],
            payrollPlanId: payrollPlan.id,
            status: 'ACTIVE',
            provenance: 'CLASSCARD_SOURCED',
            teachingHoursThisMonth: 0,
            completedClassesCount: 0,
            attendanceRate: 100,
          });

      await saveNormalizedRecord('mentor', mentor, db.getSnapshot());
      if (existing) updated++;
      else created++;
    }

    await db.persistNow();
    return NextResponse.json({
      success: true,
      totalRows: body.rows.length,
      uniqueRows: uniqueRows.size,
      created,
      updated,
      duplicatesCollapsed: body.rows.length - uniqueRows.size,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Staff import failed.' },
      { status: 500 }
    );
  }
}
