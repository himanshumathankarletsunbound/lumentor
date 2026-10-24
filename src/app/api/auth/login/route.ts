import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateSessionToken } from '../../../../lib/auth/crypto';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { findUserByEmail, saveUser } from '../../../../lib/db/state-repository';

export async function POST(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, { limit: 10, windowSeconds: 60, identifierPrefix: 'auth-login' });
  if (rateLimitError) return rateLimitError;

  try {
    await ensureServerPersistence();
    const body = await req.json().catch(() => ({}));
    const usernameOrEmail = String(body.email || body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { success: false, error: 'Username/email and password are required.' },
        { status: 400 }
      );
    }

    let user = await findUserByEmail(usernameOrEmail);
    if (!user && !usernameOrEmail.includes('@')) {
      user = await findUserByEmail(`${usernameOrEmail}@letsunbound.com`);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials. User not found.' },
        { status: 401 }
      );
    }

    // Check account status
    const status = user.status || 'ACTIVE';
    if (status === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, error: 'Your account is suspended. Please contact an administrator.' },
        { status: 403 }
      );
    }

    if (status === 'DISABLED') {
      return NextResponse.json(
        { success: false, error: 'Your account is disabled. Please contact an administrator.' },
        { status: 403 }
      );
    }

    if (status === 'SENT_PASSWORD_VERIFICATION' && (!user.passwordHash || !user.salt)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password verification pending. Please use the password setup link sent to your email.',
        },
        { status: 403 }
      );
    }

    // Verify password
    let isValid = false;
    if (user.passwordHash && user.salt) {
      isValid = verifyPassword(password, user.passwordHash, user.salt);
    } else {
      // Fallback check if user has not yet initialized hash
      isValid = password === 'admin@1290@';
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid password. Please check and try again.' },
        { status: 401 }
      );
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    user.sessionToken = sessionToken;
    user.sessionExpiry = sessionExpiry;
    user.lastLoginAt = new Date().toISOString();
    if (user.status === 'SENT_PASSWORD_VERIFICATION') {
      user.status = 'ACTIVE';
    }
    user = await saveUser(user);
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.salt;

    const response = NextResponse.json({
      success: true,
      user: safeUser,
      token: sessionToken,
    });

    // Set secure HTTP-only session cookie
    response.cookies.set({
      name: 'lumentor_session',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isMissingTable = errorMsg.includes('does not exist in the current database');
    const isDatabaseUnavailable = errorMsg.includes('Can\'t reach database server')
      || errorMsg.includes('SUPABASE_POOLER_URL must be configured');
    return NextResponse.json(
      {
        success: false,
        error: isMissingTable
          ? 'The production database schema is not initialized. Deploy the pending Prisma migrations, then try again.'
          : isDatabaseUnavailable
          ? 'The production database is unavailable from Vercel. Configure SUPABASE_POOLER_URL with the Supabase Session Pooler connection string, then redeploy.'
          : errorMsg,
      },
      { status: 500 }
    );
  }
}
