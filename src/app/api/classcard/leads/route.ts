import { NextRequest, NextResponse } from 'next/server';
import { classcardClient } from '../../../../lib/integrations/classcard/client';
import { authorizationError } from '../../../../lib/auth/server';
import type { ClasscardLeadInput } from '../../../../lib/types/classcard';

export async function POST(req: NextRequest) {
  const denied = authorizationError(req, 'students', 'create');
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Partial<ClasscardLeadInput> | null;
  if (!body || typeof body.firstName !== 'string' || !body.firstName.trim()) {
    return NextResponse.json(
      { success: false, error: 'firstName is required.' },
      { status: 400 }
    );
  }

  const result = await classcardClient.addLead({
    ...body,
    firstName: body.firstName.trim(),
  });
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
