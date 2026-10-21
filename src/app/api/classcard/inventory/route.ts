import { NextRequest, NextResponse } from 'next/server';
import { classcardClient } from '../../../../lib/integrations/classcard/client';
import { authorizationError } from '../../../../lib/auth/server';

export async function GET(req: NextRequest) {
  const denied = authorizationError(req, 'classcard_integration', 'view');
  if (denied) return denied;

  const params = req.nextUrl.searchParams;
  const status = params.get('status');
  const perPage = params.get('per_page');
  const orderBy = params.get('order_by');
  const direction = params.get('direction');

  const result = await classcardClient.getProductInventory({
    status: status === null ? undefined : Number(status),
    perPage: perPage === null ? undefined : Number(perPage),
    orderBy: orderBy === 'name' || orderBy === 'status' ? orderBy : 'product_id',
    direction: direction === 'asc' ? 'asc' : 'desc',
    search: params.get('search') || undefined,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
