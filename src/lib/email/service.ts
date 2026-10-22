import nodemailer from 'nodemailer';
import { EmailConfig } from '../types/email';
import { db } from '../db/store';
import { getServerEmailSecrets } from '../config/server';

async function resolveEmailSecrets(config: EmailConfig): Promise<EmailConfig> {
  const secrets = await getServerEmailSecrets();
  return {
    ...config,
    oauthClientSecret: secrets.oauthClientSecret || config.oauthClientSecret,
    oauthRefreshToken: secrets.oauthRefreshToken || config.oauthRefreshToken,
  };
}

export function createTransporter(config: EmailConfig) {
  if (!config.oauthClientId || !config.oauthClientSecret || !config.oauthRefreshToken) {
    throw new Error('Gmail OAuth is not connected. Authorize the Google Workspace account first.');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: config.user || config.fromEmail,
      clientId: config.oauthClientId,
      clientSecret: config.oauthClientSecret,
      refreshToken: config.oauthRefreshToken,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
}

export async function verifyGmailConnection(config: EmailConfig): Promise<{ success: boolean; message: string }> {
  config = await resolveEmailSecrets(config);
  if (!config.oauthClientId || !config.oauthClientSecret || !config.oauthRefreshToken || !config.user) {
    return { success: false, message: 'Connect a Google Workspace account and provide its email address.' };
  }

  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return {
      success: true,
      message: `Successfully connected to Google Workspace for ${config.user}.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to authenticate with Google Workspace.',
    };
  }
}

export async function sendEmail(
  options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  },
  customConfig?: EmailConfig
): Promise<{ success: boolean; messageId?: string; error?: string; mocked?: boolean }> {
  const config = await resolveEmailSecrets(customConfig || db.getEmailConfig());

  const hasValidAuth = Boolean(config.user && config.oauthClientId && config.oauthClientSecret && config.oauthRefreshToken);

  const allowSimulation = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development';
  if (!config.isEnabled || !hasValidAuth) {
    if (!allowSimulation) {
      return {
        success: false,
        error: 'Outbound email is not connected. Authorize the Google Workspace account in Email Settings.',
      };
    }
    console.log(`[SIMULATED EMAIL] To: ${options.to} | Subject: "${options.subject}"`);
    return {
      success: true,
      messageId: `simulated-${Date.now()}`,
      mocked: true,
    };
  }

  try {
    const transporter = createTransporter(config);
    const fromAddress = config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      replyTo: options.replyTo || config.replyTo || config.fromEmail,
    });

    return {
      success: true,
      messageId: info.messageId,
      mocked: false,
    };
  } catch (err: unknown) {
    console.error('Gmail OAuth sendEmail error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gmail delivery failure',
    };
  }
}

export async function sendPasswordSetupEmail(
  to: string,
  userName: string,
  setupUrl: string
): Promise<{ success: boolean; error?: string }> {
  const subject = 'Welcome to LUmentor — Set Up Your Faculty & Operations Password';
  const text = `Hello ${userName},\n\nAn institutional account has been created for you on LUmentor (Faculty & Operations Command Portal).\n\nPlease click the link below to verify your account and set up your password:\n${setupUrl}\n\nThis setup link is valid for 24 hours.\n\nBest regards,\nLUmentor Administration Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="margin-bottom: 20px; border-bottom: 2px solid #6366f1; padding-bottom: 12px;">
        <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 800;">LU<span style="color: #6366f1;">mentor</span></h2>
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600;">Faculty & Operations Portal</span>
      </div>
      <p style="font-size: 14px; margin-top: 16px;">Hello <strong>${userName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        An institutional account has been provisioned for you. Please complete your account onboarding by verifying your identity and setting your initial password.
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${setupUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Set Up Your Password</a>
      </div>
      <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
        Or copy and paste this secure link into your browser:<br/>
        <a href="${setupUrl}" style="color: #4f46e5; word-break: break-all;">${setupUrl}</a>
      </p>
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
        This link is cryptographically protected and expires in 24 hours. If you did not expect this invitation, please contact your administrator.
      </div>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetUrl: string
): Promise<{ success: boolean; error?: string }> {
  const subject = 'Password Reset Request — LUmentor Portal';
  const text = `Hello ${userName},\n\nWe received a request to reset your password for your LUmentor account.\n\nPlease click the link below to configure a new password:\n${resetUrl}\n\nThis link is valid for 60 minutes.\n\nIf you did not request this reset, you can safely ignore this email.\n\nBest regards,\nLUmentor Security Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="margin-bottom: 20px; border-bottom: 2px solid #6366f1; padding-bottom: 12px;">
        <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 800;">LU<span style="color: #6366f1;">mentor</span></h2>
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600;">Account Security</span>
      </div>
      <p style="font-size: 14px; margin-top: 16px;">Hello <strong>${userName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        A password reset authorization was requested for your account. Click the button below to update your password credentials:
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Reset Password</a>
      </div>
      <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
        Or navigate to:<br/>
        <a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a>
      </p>
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
        This token is valid for 60 minutes. If you did not initiate this request, no changes have been made to your account.
      </div>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

export async function sendTestEmail(
  to: string,
  config: EmailConfig
): Promise<{ success: boolean; message: string }> {
  const timestamp = new Date().toISOString();
  const subject = '[Test Verification] LUmentor Google Workspace email';
  const text = `This is a test email sent from LUmentor using Google Workspace OAuth.\n\nSender: ${config.fromEmail}\nTimestamp: ${timestamp}\n\nIf you are reading this, outbound email is working.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="margin-bottom: 16px; border-bottom: 2px solid #10b981; padding-bottom: 12px;">
        <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 800;">LU<span style="color: #10b981;">mentor</span> Email Test</h2>
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #059669; font-weight: 700;">Connection Verified</span>
      </div>
      <p style="font-size: 14px; color: #1e293b;">
        This test message verifies that Google Workspace OAuth outbound delivery is authenticated and operational.
      </p>
      <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 20px 0; font-family: monospace; font-size: 12px; color: #334155;">
        <div><strong>Sender Email:</strong> ${config.fromEmail}</div>
        <div><strong>Sender Display:</strong> ${config.fromName}</div>
        <div><strong>Dispatched At:</strong> ${timestamp}</div>
      </div>
      <p style="font-size: 12px; color: #64748b;">
        Automated invitations, password resets, and notifications will be sent through this authorized Google Workspace account.
      </p>
    </div>
  `;

  const res = await sendEmail({ to, subject, text, html }, config);
  if (res.success) {
    return {
      success: true,
      message: `Test email successfully dispatched to ${to} through Google Workspace.`,
    };
  } else {
    return {
      success: false,
      message: res.error || 'Failed to send test email.',
    };
  }
}
