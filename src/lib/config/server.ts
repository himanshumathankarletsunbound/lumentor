export const isDemoMode = process.env.DEMO_MODE === 'true';

export function requireServerSecret(name: 'DATABASE_URL' | 'CLASSCARD_API_KEY'): string {
  const value = process.env[name]?.trim();
  if (!value && !isDemoMode) {
    throw new Error(`${name} must be configured on the server.`);
  }
  return value || '';
}

export function serverEmailSecrets() {
  return {
    pass: process.env.EMAIL_SMTP_PASSWORD || '',
    oauthClientSecret: process.env.EMAIL_OAUTH_CLIENT_SECRET || '',
    oauthRefreshToken: process.env.EMAIL_OAUTH_REFRESH_TOKEN || '',
  };
}

export async function getServerEmailSecrets() {
  const configured = serverEmailSecrets();
  if (configured.oauthRefreshToken || isDemoMode) return configured;

  try {
    const { getEncryptedSecret } = await import('../db/secure-storage');
    return {
      ...configured,
      oauthRefreshToken: await getEncryptedSecret('email.oauth.refresh_token'),
    };
  } catch (error) {
    if (!isDemoMode) throw error;
    return configured;
  }
}

export function googleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || '',
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || '',
  };
}
