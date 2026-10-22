import { NextRequest, NextResponse } from 'next/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { findUserBySessionToken } from '../../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  try {
    await ensureServerPersistence();

    // Check cookie first, then auth header
    let token = req.cookies.get('lumentor_session')?.value;
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      // If no session token, check if there's a fallback or single super admin
      return NextResponse.json(
        { success: false, error: 'Unauthenticated. No active session.' },
        { status: 401 }
      );
    }

    const user = await findUserBySessionToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Session expired or invalid.' },
        { status: 401 }
      );
    }

    const safeUser = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.salt;
    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isMissingTable = errorMsg.includes('does not exist in the current database');
    return NextResponse.json(
      {
        success: false,
        error: isMissingTable
          ? 'The production database schema is not initialized. Deploy the pending Prisma migrations, then try again.'
          : errorMsg,
      },
      { status: 500 }
    );
  }
}
