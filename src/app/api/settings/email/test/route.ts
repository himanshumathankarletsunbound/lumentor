import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db/store';
import { verifySmtpConnection, sendTestEmail } from '../../../../../lib/email/service';
import { EmailConfig } from '../../../../../lib/types/email';
import { serverEmailSecrets } from '../../../../../lib/config/server';
import { authorizationError } from '../../../../../lib/auth/server';

export async function POST(req: NextRequest) {
  const denied = authorizationError(req, 'settings', 'manage_settings');
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    db.reloadIfModified();
    const current = db.getEmailConfig();

    const host = String(body.host || current.host || 'smtp.gmail.com').trim();
    const port = Number(body.port || current.port) || 587;
    const security = body.security || current.security || 'STARTTLS';
    const authType = body.authType === 'OAUTH2' ? 'OAUTH2' : (current.authType === 'OAUTH2' ? 'OAUTH2' : 'PASSWORD');
    const authRequired = body.authRequired !== false;
    const user = String(body.user || current.user || '').trim();

    const pass = serverEmailSecrets().pass;

    const oauthClientId = String(body.oauthClientId || current.oauthClientId || '').trim();
    const oauthClientSecret = serverEmailSecrets().oauthClientSecret;
    const oauthRefreshToken = serverEmailSecrets().oauthRefreshToken;

    const rawFrom = String(body.fromEmail || current.fromEmail || '').trim();
    const fromEmail = rawFrom.includes('@') ? rawFrom : user;
    const fromName = String(body.fromName || current.fromName || 'LUmentor Notifications').trim();
    const replyTo = String(body.replyTo || current.replyTo || '').trim();
    const allowSelfSignedCert = Boolean(body.allowSelfSignedCert ?? current.allowSelfSignedCert);
    const recipient = String(body.to || user || fromEmail || 'himanshu.m@letsunbound.com').trim();

    if (authType === 'OAUTH2') {
      if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
        return NextResponse.json(
          { success: false, error: 'Google OAuth Client ID, Client Secret, and Refresh Token are required.' },
          { status: 400 }
        );
      }
    } else {
      if (!host) {
        return NextResponse.json({ success: false, error: 'SMTP Host is required.' }, { status: 400 });
      }

      if (authRequired && (!user || !pass)) {
        return NextResponse.json(
          { success: false, error: 'SMTP Username and Password are required to test authentication.' },
          { status: 400 }
        );
      }
    }

    const testConfig: EmailConfig = {
      host,
      port,
      security,
      authType,
      authRequired,
      user,
      pass,
      oauthClientId,
      oauthClientSecret,
      oauthRefreshToken,
      fromEmail,
      fromName,
      replyTo: replyTo || undefined,
      allowSelfSignedCert,
      isEnabled: true, // test as enabled
    };

    // Step 1: Verify SMTP Handshake & Credentials
    const handshakeResult = await verifySmtpConnection(testConfig);
    if (!handshakeResult.success) {
      let friendlyError = handshakeResult.message;
      if (handshakeResult.message.includes('535') || handshakeResult.message.includes('BadCredentials')) {
        friendlyError = `Google Authentication Failed (535-5.7.8 BadCredentials). Google requires a dedicated 16-character App Password instead of your standard login password. Please generate an App Password at https://myaccount.google.com/apppasswords and enter it in the SMTP Password field.`;
      }

      db.saveEmailConfig({
        lastTestStatus: 'FAILED',
        lastTestedAt: new Date().toISOString(),
        lastTestMessage: friendlyError,
      });

      return NextResponse.json({
        success: false,
        error: `SMTP Handshake Failed: ${friendlyError}`,
        rawError: handshakeResult.message,
        isGoogleAppPasswordError: handshakeResult.message.includes('535') || handshakeResult.message.includes('BadCredentials'),
      }, { status: 400 });
    }

    // Step 2: Send test email to verify end-to-end delivery
    const sendResult = await sendTestEmail(recipient, testConfig);

    const testStatus = sendResult.success ? 'SUCCESS' : 'FAILED';
    const testMessage = sendResult.message;

    db.saveEmailConfig({
      lastTestStatus: testStatus,
      lastTestedAt: new Date().toISOString(),
      lastTestMessage: testMessage,
    });

    db.logAudit({
      userId: 'user-admin',
      userName: 'Administrator',
      userRole: 'ADMINISTRATOR',
      action: 'EMAIL_TEST_PERFORMED',
      entityType: 'EmailConfig',
      entityId: 'email-smtp-config',
      details: `Tested SMTP configuration to ${recipient}: ${testStatus} (${testMessage})`,
    });

    return NextResponse.json({
      success: sendResult.success,
      message: testMessage,
      testedRecipient: recipient,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'SMTP diagnostic execution failed' },
      { status: 500 }
    );
  }
}
