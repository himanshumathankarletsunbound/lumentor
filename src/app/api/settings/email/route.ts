import { NextRequest, NextResponse } from 'next/server';
import { getServerEmailSecrets, googleOAuthConfig } from '../../../../lib/config/server';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { getPersistedEmailConfig, savePersistedEmailConfig } from '../../../../lib/db/state-repository';

function safeEmailConfig(config: Partial<import('../../../../lib/types/email').EmailConfig>) {
  const google = googleOAuthConfig();
  return {
    user: config.user || '',
    fromEmail: config.fromEmail || '',
    fromName: config.fromName || '',
    replyTo: config.replyTo || '',
    isEnabled: Boolean(config.isEnabled),
    lastTestStatus: config.lastTestStatus,
    lastTestedAt: config.lastTestedAt,
    lastTestMessage: config.lastTestMessage,
    oauthClientId: google.clientId || config.oauthClientId || '',
    oauthConfigured: Boolean(google.clientId && google.clientSecret && google.redirectUri),
    oauthConnected: false,
  };
}

export async function GET(req: NextRequest) {
  try {
    await ensureServerPersistence();
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Database initialization failed.' }, { status: 503 });
  }
  const denied = await authorizationErrorAsync(req, 'settings', 'manage_settings');
  if (denied) return denied;
  try {
    const secrets = await getServerEmailSecrets();
    const config = await getPersistedEmailConfig();
    return NextResponse.json({
      success: true,
      emailConfig: { ...safeEmailConfig(config), oauthConnected: Boolean(secrets.oauthRefreshToken) },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch email settings' },
      { status: 500 }
    );
  }
}

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
    const current = await getPersistedEmailConfig();
    const user = String(body.user ?? current.user ?? '').trim();
    const fromEmail = String(body.fromEmail ?? user ?? current.fromEmail ?? '').trim();
    const fromName = String(body.fromName ?? current.fromName ?? 'LUmentor Notifications').trim();
    const replyTo = String(body.replyTo ?? current.replyTo ?? '').trim();
    const isEnabled = Boolean(body.isEnabled);
    const google = googleOAuthConfig();
    const secrets = await getServerEmailSecrets();

    if (!user || !user.includes('@')) {
      return NextResponse.json({ success: false, error: 'Enter the Google Workspace sender email address.' }, { status: 400 });
    }
    if (!fromEmail || !fromEmail.includes('@')) {
      return NextResponse.json({ success: false, error: 'Enter a valid From email address.' }, { status: 400 });
    }
    if (isEnabled && (!google.clientId || !google.clientSecret || !google.redirectUri || !secrets.oauthRefreshToken)) {
      return NextResponse.json(
        { success: false, error: 'Connect the Google Workspace account before enabling outbound email.' },
        { status: 400 }
      );
    }

    const updated = { user, fromEmail, fromName, replyTo: replyTo || undefined, isEnabled };
    await savePersistedEmailConfig(updated);

    return NextResponse.json({
      success: true,
      emailConfig: {
        ...safeEmailConfig(updated),
        user: updated.user,
        fromEmail: updated.fromEmail,
        fromName: updated.fromName,
        replyTo: updated.replyTo,
        isEnabled: updated.isEnabled,
      },
      message: 'Google Workspace outbound email configuration saved.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to save email settings' },
      { status: 500 }
    );
  }
}
