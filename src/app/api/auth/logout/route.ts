import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('lumentor_session')?.value;
    if (sessionToken) {
      const user = db.getUserBySessionToken(sessionToken);
      if (user) {
        user.sessionToken = undefined;
        user.sessionExpiry = undefined;
        db.saveUser(user);

        db.logAudit({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: 'LOGOUT',
          entityType: 'User',
          entityId: user.id,
          details: `User ${user.email} logged out`,
        });
      }
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

    // Clear session cookie
    response.cookies.set({
      name: 'lumentor_session',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
