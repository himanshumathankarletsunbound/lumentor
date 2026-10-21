import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';

export async function GET(req: NextRequest) {
  try {
    db.reloadIfModified();

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

    const user = db.getUserBySessionToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Session expired or invalid.' },
        { status: 401 }
      );
    }

    const { passwordHash: _h, salt: _s, ...safeUser } = user;
    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
