import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { db } from '../../../lib/db/store';
import { PenaltyDeductionType } from '../../../lib/types/payroll';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'penalties', 'view');
  if (denied) return denied;
  return NextResponse.json({
    success: true,
    policies: db.getPenaltyPolicies(),
  });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'penalties', 'create');
  if (denied) return denied;
  if ((await getSessionUserAsync(req))?.role !== 'ADMINISTRATOR') {
    return NextResponse.json(
      { success: false, error: 'Only administrators can manage penalty policies.' },
      { status: 403 }
    );
  }
  try {
    const body = (await req.json()) as {
      id?: string;
      code?: string;
      name?: string;
      title?: string;
      description?: string;
      deductionType?: PenaltyDeductionType;
      type?: 'percent' | 'amount' | 'PERCENT' | 'FIXED_AMOUNT';
      rateValue?: number;
      defaultAmount?: number;
    };

    const policyName = (body.name || body.title || '').trim();
    if (!policyName) {
      return NextResponse.json({ success: false, error: 'Policy title is required.' }, { status: 400 });
    }

    const rawType = (body.deductionType || body.type || 'FIXED_AMOUNT').toString().toUpperCase();
    const deductionType: PenaltyDeductionType = rawType.includes('PERCENT') ? 'PERCENT' : 'FIXED_AMOUNT';
    const rateValue = Number(body.rateValue ?? body.defaultAmount ?? 0);

    const policy = db.createPenaltyPolicy({
      id: body.id?.trim() || body.code?.trim(),
      code: body.code?.trim() || body.id?.trim(),
      name: policyName,
      description: body.description?.trim() ?? '',
      deductionType,
      rateValue,
      defaultAmount: deductionType === 'FIXED_AMOUNT' ? rateValue : Number(body.defaultAmount ?? 0),
      isActive: true,
    });
    await db.persistNow();
    return NextResponse.json({ success: true, policy }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to create policy.' },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'penalties', 'edit');
  if (denied) return denied;
  if ((await getSessionUserAsync(req))?.role !== 'ADMINISTRATOR') {
    return NextResponse.json(
      { success: false, error: 'Only administrators can manage penalty policies.' },
      { status: 403 }
    );
  }
  try {
    const body = (await req.json()) as {
      id?: string;
      updates?: {
        name?: string;
        title?: string;
        description?: string;
        deductionType?: PenaltyDeductionType;
        rateValue?: number;
        defaultAmount?: number;
        isActive?: boolean;
      };
    };

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Policy ID is required.' }, { status: 400 });
    }

    const updates = body.updates || {};
    const updated = db.updatePenaltyPolicy(body.id, {
      ...updates,
      name: updates.name || updates.title,
    });
    await db.persistNow();
    return NextResponse.json({ success: true, policy: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to update policy.' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'penalties', 'delete');
  if (denied) return denied;
  if ((await getSessionUserAsync(req))?.role !== 'ADMINISTRATOR') {
    return NextResponse.json(
      { success: false, error: 'Only administrators can manage penalty policies.' },
      { status: 403 }
    );
  }
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Policy id is required.' }, { status: 400 });
  db.deletePenaltyPolicy(id);
  await db.persistNow();
  return NextResponse.json({ success: true });
}
