import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { db } from '../../../lib/db/store';
import { CompensationModel } from '../../../lib/types/payroll';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_rules', 'view');
  if (denied) return denied;

  return NextResponse.json({
    success: true,
    plans: db.getPayrollPlans(),
  });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_rules', 'create');
  if (denied) return denied;

  const user = await getSessionUserAsync(req);
  if (user?.role !== 'ADMINISTRATOR' && user?.role !== 'OPERATIONS') {
    return NextResponse.json(
      { success: false, error: 'Only administrators and operations managers can configure payroll plans.' },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as {
      name: string;
      code: string;
      description?: string;
      compensationModel: CompensationModel;
      currency?: string;
      baseSalary?: number;
      defaultClassRate?: number;
      hourlyRate?: number;
      perStudentRate?: number;
      revenuePercentage?: number;
      minEligibleDurationMinutes?: number;
      payableClassStatuses?: any[];
      lateCancellationPayPercent?: number;
      groupMultiplier?: number;
      formula?: string;
    };

    if (!body.name?.trim() || !body.code?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Plan Name and Plan Code are required.' },
        { status: 400 }
      );
    }

    const newPlan = db.createPayrollPlan({
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      description: body.description?.trim() || '',
      compensationModel: body.compensationModel || 'PER_CLASS',
      currency: body.currency || 'INR',
      baseSalary: Number(body.baseSalary) || 0,
      defaultClassRate: Number(body.defaultClassRate) || 0,
      hourlyRate: Number(body.hourlyRate) || 0,
      perStudentRate: Number(body.perStudentRate) || 0,
      revenuePercentage: Number(body.revenuePercentage) || 0,
      minEligibleDurationMinutes: Number(body.minEligibleDurationMinutes) || 30,
      payableClassStatuses: body.payableClassStatuses || ['COMPLETED', 'LATE_CANCELLED'],
      lateCancellationPayPercent: Number(body.lateCancellationPayPercent) || 50,
      groupMultiplier: Number(body.groupMultiplier) || 1.25,
      formula: body.formula?.trim() || '',
      effectiveFrom: new Date().toISOString(),
      isActive: true,
    });

    await db.persistNow();

    return NextResponse.json({ success: true, plan: newPlan }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create payroll plan.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_rules', 'edit');
  if (denied) return denied;

  const user = await getSessionUserAsync(req);
  if (user?.role !== 'ADMINISTRATOR' && user?.role !== 'OPERATIONS') {
    return NextResponse.json(
      { success: false, error: 'Only administrators and operations managers can update payroll plans.' },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as {
      id: string;
      name?: string;
      code?: string;
      description?: string;
      compensationModel?: CompensationModel;
      currency?: string;
      baseSalary?: number;
      defaultClassRate?: number;
      hourlyRate?: number;
      perStudentRate?: number;
      revenuePercentage?: number;
      minEligibleDurationMinutes?: number;
      lateCancellationPayPercent?: number;
      groupMultiplier?: number;
      formula?: string;
      isActive?: boolean;
    };

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Plan ID is required.' }, { status: 400 });
    }

    const updated = db.updatePayrollPlan(
      body.id,
      {
        ...(body.name && { name: body.name.trim() }),
        ...(body.code && { code: body.code.trim().toUpperCase() }),
        ...(body.description !== undefined && { description: body.description.trim() }),
        ...(body.compensationModel && { compensationModel: body.compensationModel }),
        ...(body.currency && { currency: body.currency }),
        ...(body.baseSalary !== undefined && { baseSalary: Number(body.baseSalary) }),
        ...(body.defaultClassRate !== undefined && { defaultClassRate: Number(body.defaultClassRate) }),
        ...(body.hourlyRate !== undefined && { hourlyRate: Number(body.hourlyRate) }),
        ...(body.perStudentRate !== undefined && { perStudentRate: Number(body.perStudentRate) }),
        ...(body.revenuePercentage !== undefined && { revenuePercentage: Number(body.revenuePercentage) }),
        ...(body.minEligibleDurationMinutes !== undefined && { minEligibleDurationMinutes: Number(body.minEligibleDurationMinutes) }),
        ...(body.lateCancellationPayPercent !== undefined && { lateCancellationPayPercent: Number(body.lateCancellationPayPercent) }),
        ...(body.groupMultiplier !== undefined && { groupMultiplier: Number(body.groupMultiplier) }),
        ...(body.formula !== undefined && { formula: body.formula.trim() }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      true // bump version
    );

    await db.persistNow();

    return NextResponse.json({ success: true, plan: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update payroll plan.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_rules', 'delete');
  if (denied) return denied;

  const user = await getSessionUserAsync(req);
  if (user?.role !== 'ADMINISTRATOR') {
    return NextResponse.json(
      { success: false, error: 'Only administrators can delete payroll plans.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Plan ID is required.' }, { status: 400 });
    }

    // Check if any mentor is using this plan
    const mentors = db.getMentors();
    const isUsed = mentors.some((m) => m.payrollPlanId === id);
    if (isUsed) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete plan assigned to active mentors.' },
        { status: 400 }
      );
    }

    const deleted = db.deletePayrollPlan(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Plan not found.' }, { status: 404 });
    }

    await db.persistNow();
    return NextResponse.json({ success: true, message: 'Plan deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete payroll plan.' },
      { status: 500 }
    );
  }
}
