import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { googleOAuthConfig } from '../../../../../../lib/config/server';
import { setEncryptedSecret } from '../../../../../../lib/db/secure-storage';
import { db } from '../../../../../../lib/db/store';

function validState(state: string, expected: string): boolean {
  const [nonce, signature] = state.split('.');
  const key = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!nonce || !signature || !key || state !== expected) return false;
  const actual = createHmac('sha256', key).update(nonce).digest();
  const supplied = Buffer.from(signature, 'base64url');
  return actual.length === supplied.length && timingSafeEqual(actual, supplied);
}

export async function GET(req: NextRequest) {
  const repository = await import('../../../../../../lib/db/state-repository');
  globalThis.lumentorPostgresRepository = repository;
  await db.ready();

  const error = req.nextUrl.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(new URL(`/admin/settings?emailOAuth=error&message=${encodeURIComponent(error)}`, req.url));
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const expectedState = req.cookies.get('lumentor_gmail_oauth_state')?.value;
  if (!code || !state || !expectedState || !validState(state, expectedState)) {
    return NextResponse.json({ success: false, error: 'Invalid or expired Gmail OAuth state.' }, { status: 400 });
  }

  const config = googleOAuthConfig();
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const token = (await tokenResponse.json()) as { refresh_token?: string; access_token?: string; error?: string };
  if (!tokenResponse.ok || !token.refresh_token) {
    return NextResponse.json(
      { success: false, error: token.error || 'Google did not return a refresh token. Revoke the existing grant and retry.' },
      { status: 502 }
    );
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = (await profileResponse.json()) as { email?: string };
  await setEncryptedSecret('email.oauth.refresh_token', token.refresh_token);
  await db.ready();
  db.saveEmailConfig({
    authType: 'OAUTH2',
    oauthClientId: config.clientId,
    user: profile.email || db.getEmailConfig().user,
    fromEmail: profile.email || db.getEmailConfig().fromEmail,
    isEnabled: false,
  });

  const response = NextResponse.redirect(new URL('/admin/settings?emailOAuth=success', req.url));
  response.cookies.delete('lumentor_gmail_oauth_state');
  return response;
}
