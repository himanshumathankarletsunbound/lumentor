import { createHmac, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorizationError } from '../../../../../../lib/auth/server';
import { googleOAuthConfig } from '../../../../../../lib/config/server';

function signState(value: string): string {
  const key = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error('APP_ENCRYPTION_KEY must be configured before starting Gmail OAuth.');
  return createHmac('sha256', key).update(value).digest('base64url');
}

export async function GET(req: NextRequest) {
  const denied = authorizationError(req, 'settings', 'manage_settings');
  if (denied) return denied;

  const config = googleOAuthConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    return NextResponse.json(
      { success: false, error: 'GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI are required.' },
      { status: 503 }
    );
  }

  const nonce = randomBytes(24).toString('base64url');
  const state = `${nonce}.${signState(nonce)}`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', 'https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email');
  url.searchParams.set('state', state);

  const response = NextResponse.redirect(url);
  response.cookies.set('lumentor_gmail_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/settings/email/oauth',
  });
  return response;
}
