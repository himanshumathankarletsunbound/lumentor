import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { CompensationModel } from '../../../lib/types/payroll';
import {
  countMentorsAssignedToPayrollPlan,
  createPayrollPlan,
  deletePayrollPlan,
  listPayrollPlans,
  updatePayrollPlan,
} from '../../../lib/db/state-repository';

function numberOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function invalidNumericFields(body: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined) continue;
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0) return `${field} must be a non-negative number.`;
  }
  return null;
}

const COMPENSATION_MODELS: CompensationModel[] = [
  'PER_CLASS',
  'DURATION_BASED',
  'PER_STUDENT',
  'FIXED_SALARY',
  'PERCENTAGE_BASED',
  'HYBRID',
];

function isCompensationModel(value: unknown): value is CompensationModel {
  return typeof value === 'string' && COMPENSATION_MODELS.includes(value as CompensationModel);
}

function isUniquePlanCodeError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2002'
    && 'meta' in error
    && JSON.stringify(error.meta).includes('PayrollPlan_code_key');
}

function normalizeCompensationValues(model: CompensationModel, values: {
  baseSalary: number;
  defaultClassRate: number;
  hourlyRate: number;
  perStudentRate: number;
  revenuePercentage: number;
}): typeof values {
  return {
    baseSalary: model === 'FIXED_SALARY' || model === 'HYBRID' ? values.baseSalary : 0,
    defaultClassRate: model === 'PER_CLASS' || model === 'HYBRID' ? values.defaultClassRate : 0,
    hourlyRate: model === 'DURATION_BASED' || model === 'HYBRID' ? values.hourlyRate : 0,
    perStudentRate: model === 'PER_STUDENT' || model === 'HYBRID' ? values.perStudentRate : 0,
    revenuePercentage: model === 'PERCENTAGE_BASED' || model === 'HYBRID' ? values.revenuePercentage : 0,
  };
}

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_rules', 'view');
  if (denied) return denied;

  return NextResponse.json({
    success: true,
    plans: await listPayrollPlans(),
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
      payableClassStatuses?: ('SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'LATE_CANCELLED')[];
      lateCancellationPayPercent?: number;
      groupMultiplier?: number;
      formula?: string;
    };
    const numericError = invalidNumericFields(body as unknown as Record<string, unknown>, [
      'baseSalary', 'defaultClassRate', 'hourlyRate', 'perStudentRate',
      'revenuePercentage', 'minEligibleDurationMinutes', 'lateCancellationPayPercent', 'groupMultiplier',
    ]);
    if (numericError) return NextResponse.json({ success: false, error: numericError }, { status: 400 });

    if (!body.name?.trim() || !body.code?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Plan Name and Plan Code are required.' },
        { status: 400 }
      );
    }

    const code = body.code.trim().toUpperCase();
    const existingPlan = (await listPayrollPlans()).find((plan) => plan.code.toUpperCase() === code);
    if (existingPlan) {
      return NextResponse.json(
        { success: false, error: `A payroll plan with code "${code}" already exists. Use a unique Plan Code.` },
        { status: 409 }
      );
    }

    if (!isCompensationModel(body.compensationModel)) {
      return NextResponse.json(
        { success: false, error: 'A valid Compensation Model is required.' },
        { status: 400 }
      );
    }

    const compensationValues = normalizeCompensationValues(body.compensationModel, {
      baseSalary: numberOrDefault(body.baseSalary, 0),
      defaultClassRate: numberOrDefault(body.defaultClassRate, 0),
      hourlyRate: numberOrDefault(body.hourlyRate, 0),
      perStudentRate: numberOrDefault(body.perStudentRate, 0),
      revenuePercentage: numberOrDefault(body.revenuePercentage, 0),
    });
    const newPlan = await createPayrollPlan({
      name: body.name.trim(),
      code,
      description: body.description?.trim() || '',
      compensationModel: body.compensationModel,
      currency: body.currency || 'INR',
      ...compensationValues,
      minEligibleDurationMinutes: numberOrDefault(body.minEligibleDurationMinutes, body.compensationModel === 'DURATION_BASED' ? 30 : 0),
      payableClassStatuses: body.payableClassStatuses || ['COMPLETED', 'LATE_CANCELLED'],
      lateCancellationPayPercent: numberOrDefault(body.lateCancellationPayPercent, 50),
      groupMultiplier: numberOrDefault(body.groupMultiplier, 1.25),
      formula: body.formula?.trim() || '',
      version: 1,
      effectiveFrom: new Date().toISOString(),
      isActive: true,
    });


    return NextResponse.json({ success: true, plan: newPlan }, { status: 201 });
  } catch (err: unknown) {
    if (isUniquePlanCodeError(err)) {
      return NextResponse.json(
        { success: false, error: 'That payroll plan code is already in use. Enter a unique Plan Code.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to create payroll plan.' },
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
    const numericError = invalidNumericFields(body as unknown as Record<string, unknown>, [
      'baseSalary', 'defaultClassRate', 'hourlyRate', 'perStudentRate',
      'revenuePercentage', 'minEligibleDurationMinutes', 'lateCancellationPayPercent', 'groupMultiplier',
    ]);
    if (numericError) return NextResponse.json({ success: false, error: numericError }, { status: 400 });

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Plan ID is required.' }, { status: 400 });
    }

    const current = (await listPayrollPlans()).find((plan) => plan.id === body.id);
    if (!current) return NextResponse.json({ success: false, error: 'Plan not found.' }, { status: 404 });
    const nextCode = body.code?.trim().toUpperCase();
    if (nextCode && nextCode !== current.code.toUpperCase()) {
      const duplicate = (await listPayrollPlans()).some(
        (plan) => plan.id !== body.id && plan.code.toUpperCase() === nextCode
      );
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `A payroll plan with code "${nextCode}" already exists. Use a unique Plan Code.` },
          { status: 409 }
        );
      }
    }
    if (body.compensationModel !== undefined && !isCompensationModel(body.compensationModel)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Compensation Model.' },
        { status: 400 }
      );
    }
    const nextModel = body.compensationModel ?? current.compensationModel;
    const rawValues = {
      compensationModel: nextModel,
      baseSalary: body.baseSalary !== undefined ? Number(body.baseSalary) : current.baseSalary,
      defaultClassRate: body.defaultClassRate !== undefined ? Number(body.defaultClassRate) : current.defaultClassRate,
      hourlyRate: body.hourlyRate !== undefined ? Number(body.hourlyRate) : current.hourlyRate,
      perStudentRate: body.perStudentRate !== undefined ? Number(body.perStudentRate) : current.perStudentRate,
      revenuePercentage: body.revenuePercentage !== undefined ? Number(body.revenuePercentage) : current.revenuePercentage,
      minEligibleDurationMinutes: body.minEligibleDurationMinutes !== undefined
        ? Number(body.minEligibleDurationMinutes)
        : current.minEligibleDurationMinutes,
      lateCancellationPayPercent: body.lateCancellationPayPercent !== undefined
        ? Number(body.lateCancellationPayPercent)
        : current.lateCancellationPayPercent,
      groupMultiplier: body.groupMultiplier !== undefined ? Number(body.groupMultiplier) : current.groupMultiplier,
    };
    const nextValues = {
      ...rawValues,
      ...normalizeCompensationValues(nextModel, rawValues),
    };
    const compensationChanged = [
      nextValues.compensationModel !== current.compensationModel,
      nextValues.baseSalary !== current.baseSalary,
      nextValues.defaultClassRate !== current.defaultClassRate,
      nextValues.hourlyRate !== current.hourlyRate,
      nextValues.perStudentRate !== current.perStudentRate,
      nextValues.revenuePercentage !== current.revenuePercentage,
      nextValues.minEligibleDurationMinutes !== current.minEligibleDurationMinutes,
      nextValues.lateCancellationPayPercent !== current.lateCancellationPayPercent,
      nextValues.groupMultiplier !== current.groupMultiplier,
    ].some(Boolean);
    if (compensationChanged) {
      const assignedMentorCount = await countMentorsAssignedToPayrollPlan(body.id);
      if (assignedMentorCount > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `This plan is assigned to ${assignedMentorCount} mentor${assignedMentorCount === 1 ? '' : 's'}. Create a new payroll plan for changed compensation rules so existing mentor assignments and payroll calculations are not changed.`,
          },
          { status: 409 }
        );
      }
    }
    const updated = await updatePayrollPlan(
      body.id,
      {
        ...current,
        ...(body.name && { name: body.name.trim() }),
        ...(body.code && { code: body.code.trim().toUpperCase() }),
        ...(body.description !== undefined && { description: body.description.trim() }),
        ...(body.compensationModel && { compensationModel: body.compensationModel }),
        ...(body.currency && { currency: body.currency }),
        baseSalary: nextValues.baseSalary,
        defaultClassRate: nextValues.defaultClassRate,
        hourlyRate: nextValues.hourlyRate,
        perStudentRate: nextValues.perStudentRate,
        revenuePercentage: nextValues.revenuePercentage,
        ...(body.minEligibleDurationMinutes !== undefined && {
          minEligibleDurationMinutes: Number.isFinite(Number(body.minEligibleDurationMinutes))
            ? Number(body.minEligibleDurationMinutes)
            : current.compensationModel === 'DURATION_BASED' ? 30 : 0,
        }),
        ...(body.lateCancellationPayPercent !== undefined && { lateCancellationPayPercent: Number(body.lateCancellationPayPercent) }),
        ...(body.groupMultiplier !== undefined && { groupMultiplier: Number(body.groupMultiplier) }),
        ...(body.formula !== undefined && { formula: body.formula.trim() }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    );

    return NextResponse.json({ success: true, plan: updated });
  } catch (err: unknown) {
    if (isUniquePlanCodeError(err)) {
      return NextResponse.json(
        { success: false, error: 'That payroll plan code is already in use. Enter a unique Plan Code.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update payroll plan.' },
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
    const mentors = await import('../../../lib/db/state-repository').then(({ listMentors }) => listMentors());
    const isUsed = mentors.some((m) => m.payrollPlanId === id);
    if (isUsed) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete plan assigned to active mentors.' },
        { status: 400 }
      );
    }

    await deletePayrollPlan(id);
    return NextResponse.json({ success: true, message: 'Plan deleted successfully.' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to delete payroll plan.' },
      { status: 500 }
    );
  }
}
