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
