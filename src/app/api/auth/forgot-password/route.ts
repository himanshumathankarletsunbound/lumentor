import { NextRequest, NextResponse } from 'next/server';
import { generateResetToken } from '../../../../lib/auth/crypto';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { sendPasswordResetEmail } from '../../../../lib/email/service';
import { findUserByEmail, saveUser } from '../../../../lib/db/state-repository';

export async function POST(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, { limit: 5, windowSeconds: 60, identifierPrefix: 'auth-forgot-password' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email address is required.' },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);

    if (!user) {
      // Return clear notification if account not found
      return NextResponse.json(
        {
          success: false,
          error: `No account found with email address "${email}". Please verify or contact your administrator.`,
        },
        { status: 404 }
      );
    }

    // Generate reset token valid for 60 minutes
    const { token, expiresAt } = generateResetToken(60);
    user.resetToken = token;
    user.resetTokenExpiry = expiresAt;
    await saveUser(user);

    const origin = req.nextUrl.origin || 'http://localhost:3005';
    const resetUrl = `${origin}/reset-password?token=${token}`;

    // Dispatch email asynchronously using the configured Google Workspace OAuth account.
    sendPasswordResetEmail(user.email, user.name, resetUrl).catch((e) => {
      console.warn('Failed to dispatch password reset email:', e);
    });

    return NextResponse.json({
      success: true,
      message: `Password reset link generated for ${user.email}. Valid for 60 minutes.`,
      resetToken: token,
      resetUrl,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
