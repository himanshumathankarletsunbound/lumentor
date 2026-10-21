import { NextRequest, NextResponse } from 'next/server';
import { db } from '../db/store';
import { hasPermission } from './permissions';
import type { CurrentUser, PermissionAction, PermissionModule } from '../types/auth';

export class ApiAuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message);
  }
}

export function getSessionUser(req: NextRequest): CurrentUser | undefined {
  const cookieToken = req.cookies.get('lumentor_session')?.value;
  const authorization = req.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : undefined;
  const token = cookieToken || bearerToken;

  if (!token) return undefined;
  return db.getUserBySessionToken(token);
}

export function requireUser(req: NextRequest): CurrentUser {
  const user = getSessionUser(req);
  if (!user) {
    throw new ApiAuthError(401, 'Authentication is required.');
  }
  if (user.status && user.status !== 'ACTIVE') {
    throw new ApiAuthError(403, 'This account is not active.');
  }
  return user;
}

export function requirePermission(
  req: NextRequest,
  module: PermissionModule,
  action: PermissionAction
): CurrentUser {
  const user = requireUser(req);
  if (!hasPermission(user, module, action)) {
    throw new ApiAuthError(403, 'You do not have permission to perform this action.');
  }
  return user;
}

export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  throw error;
}

export function authorizationError(
  req: NextRequest,
  module?: PermissionModule,
  action?: PermissionAction
): NextResponse | undefined {
  try {
    if (module && action) requirePermission(req, module, action);
    else requireUser(req);
    return undefined;
  } catch (error) {
    return authErrorResponse(error);
  }
}

export function withApiAuth<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
  authorize: (req: NextRequest) => CurrentUser = requireUser
) {
  return async (...args: TArgs): Promise<Response> => {
    try {
      const req = args[0] as NextRequest;
      authorize(req);
      return await handler(...args);
    } catch (error) {
      return authErrorResponse(error);
    }
  };
}
