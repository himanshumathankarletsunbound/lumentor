import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';
import { EmailConfig } from '../../../../lib/types/email';

function sanitizeEmailConfig(config: EmailConfig) {
  const { pass, ...safeConfig } = config;
  return {
    ...safeConfig,
    hasPassword: Boolean(pass && pass.length > 0),
    maskedPassword: pass ? '••••••••••••' : '',
  };
}

export async function GET() {
  try {
    db.reloadIfModified();
    const config = db.getEmailConfig();
    return NextResponse.json({
      success: true,
      emailConfig: sanitizeEmailConfig(config),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch email settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    db.reloadIfModified();
    const current = db.getEmailConfig();

    const host = String(body.host ?? current.host).trim();
    const port = Number(body.port ?? current.port) || 587;
    const security = body.security || current.security || 'STARTTLS';
    const authRequired = body.authRequired !== false;
    const user = String(body.user ?? current.user).trim();
    
    // Preserve existing password if user didn't change it or sent empty
    let pass = current.pass;
    if (typeof body.pass === 'string' && body.pass.trim().length > 0 && body.pass !== '••••••••••••') {
      pass = body.pass.trim();
    }

    const fromEmail = String(body.fromEmail ?? current.fromEmail).trim();
    const fromName = String(body.fromName ?? current.fromName).trim();
    const replyTo = String(body.replyTo ?? current.replyTo ?? '').trim();
    const allowSelfSignedCert = Boolean(body.allowSelfSignedCert);
    const isEnabled = Boolean(body.isEnabled);

    if (fromEmail && (!fromEmail.includes('@') || !fromEmail.includes('.'))) {
      return NextResponse.json(
        {
          success: false,
          error: `From Email Address must be a valid email (e.g. ${user || 'notifications@letsunbound.com'}), got "${fromEmail}". Please correct this.`,
        },
        { status: 400 }
      );
    }

    if (isEnabled && (!host || !user || !pass || !fromEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: 'To enable outbound email, Host, Username, Password, and From Email are required.',
        },
        { status: 400 }
      );
    }

    const updated = db.saveEmailConfig({
      host,
      port,
      security,
      authRequired,
      user,
      pass,
      fromEmail,
      fromName,
      replyTo: replyTo || undefined,
      allowSelfSignedCert,
      isEnabled,
    });

    db.logAudit({
      userId: 'user-admin',
      userName: 'Administrator',
      userRole: 'ADMINISTRATOR',
      action: 'EMAIL_CONFIG_UPDATED',
      entityType: 'EmailConfig',
      entityId: 'email-smtp-config',
      details: `Updated SMTP email configuration for ${fromEmail} via host ${host}:${port} (Enabled: ${isEnabled ? 'YES' : 'NO'})`,
    });

    return NextResponse.json({
      success: true,
      emailConfig: sanitizeEmailConfig(updated),
      message: 'Email configuration saved successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save email settings' },
      { status: 500 }
    );
  }
}
