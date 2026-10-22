import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db/store';
import { sendTestEmail, verifyGmailConnection } from '../../../../../lib/email/service';
import { getServerEmailSecrets, googleOAuthConfig } from '../../../../../lib/config/server';
import { authorizationError } from '../../../../../lib/auth/server';

export async function POST(req: NextRequest) {
  const denied = authorizationError(req, 'settings', 'manage_settings');
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    await db.ready();
    const current = db.getEmailConfig();
    const secrets = await getServerEmailSecrets();
    const google = googleOAuthConfig();
    const config = {
      ...current,
      user: String(body.user || current.user || '').trim(),
      fromEmail: String(body.fromEmail || current.fromEmail || '').trim(),
      fromName: String(body.fromName || current.fromName || 'LUmentor Notifications').trim(),
      oauthClientId: google.clientId || current.oauthClientId,
      oauthClientSecret: secrets.oauthClientSecret,
      oauthRefreshToken: secrets.oauthRefreshToken,
      isEnabled: true,
    };
    const recipient = String(body.to || config.user).trim();
    if (!recipient.includes('@')) {
      return NextResponse.json({ success: false, error: 'Enter a valid recipient email address.' }, { status: 400 });
    }

    const verification = await verifyGmailConnection(config);
    if (!verification.success) {
      return NextResponse.json({ success: false, error: verification.message }, { status: 400 });
    }
    const result = await sendTestEmail(recipient, config);
    const status = result.success ? 'SUCCESS' : 'FAILED';
    db.saveEmailConfig({
      lastTestStatus: status,
      lastTestedAt: new Date().toISOString(),
      lastTestMessage: result.message,
    });
    return NextResponse.json({ success: result.success, message: result.message, testedRecipient: recipient });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Google Workspace email test failed' },
      { status: 500 }
    );
  }
}
