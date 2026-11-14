import { NextRequest, NextResponse } from 'next/server';
import { generateResetToken } from '../../../../lib/auth/crypto';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { sendPasswordResetEmail } from '../../../../lib/email/service';
import { findUserByEmail, saveUser } from '../../../../lib/db/state-repository';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';

export async function POST(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, { limit: 5, windowSeconds: 60, identifierPrefix: 'auth-forgot-password' });
  if (rateLimitError) return rateLimitError;

  try {
    await ensureServerPersistence();
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

    // Do not report success until Google Workspace accepted the message. This
    // prevents an unusable reset link from being presented as a sent email.
    const delivery = await sendPasswordResetEmail(user.email, user.name, resetUrl);
    if (!delivery.success) {
      return NextResponse.json(
        { success: false, error: `Password reset email could not be sent: ${delivery.error || 'email service unavailable'}` },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists for this email address, password reset instructions have been sent. The link is valid for 60 minutes.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
