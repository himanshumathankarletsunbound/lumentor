import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db/store';
import { sendTestEmail, verifyGmailConnection } from '../../../../../lib/email/service';
import { getServerEmailSecrets, googleOAuthConfig } from '../../../../../lib/config/server';
import { authorizationErrorAsync } from '../../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../../lib/db/server-initialization';

export async function POST(req: NextRequest) {
  try {
    await ensureServerPersistence();
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Database initialization failed.' }, { status: 503 });
  }
  const denied = await authorizationErrorAsync(req, 'settings', 'manage_settings');
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
    if (!config.user || !config.fromEmail) {
      return NextResponse.json(
        { success: false, error: 'Google Workspace is connected, but no sender email is configured. Reconnect Google Workspace or enter the Workspace email and save settings.' },
        { status: 400 }
      );
    }
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
