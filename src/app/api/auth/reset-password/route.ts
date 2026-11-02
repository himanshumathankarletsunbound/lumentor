import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '../../../../lib/auth/crypto';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { findUserByResetToken, saveUser } from '../../../../lib/db/state-repository';
import { getSessionUserAsync } from '../../../../lib/auth/server';

export async function POST(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, { limit: 10, windowSeconds: 60, identifierPrefix: 'auth-reset-password' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!token && !(await getSessionUserAsync(req))?.mustChangePassword) {
      return NextResponse.json(
        { success: false, error: 'Password reset token is required.' },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const user = token ? await findUserByResetToken(token) : await getSessionUserAsync(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired password reset token. Please request a new link.' },
        { status: 400 }
      );
    }

    // Check expiration
    if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) <= new Date()) {
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await saveUser(user);

      return NextResponse.json(
        { success: false, error: 'Password reset token has expired. Please request a new link.' },
        { status: 400 }
      );
    }

    // Hash the new password with a fresh cryptographic salt
    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    user.mustChangePassword = false;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    // Invalidate existing sessions for security
    user.sessionToken = undefined;
    user.sessionExpiry = undefined;
    if (user.status === 'SENT_PASSWORD_VERIFICATION') {
      user.status = 'ACTIVE';
    }
    await saveUser(user);

    return NextResponse.json({
      success: true,
      message: 'Password successfully updated. You may now sign in with your new credentials.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
