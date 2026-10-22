export interface EmailConfig {
  host: string;
  port: number;
  security: 'STARTTLS' | 'SSL_TLS' | 'NONE';
  authType?: 'PASSWORD' | 'OAUTH2';
  authRequired: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  allowSelfSignedCert: boolean;
  isEnabled: boolean;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthRefreshToken?: string;
  lastTestStatus?: 'SUCCESS' | 'FAILED' | 'UNTESTED';
  lastTestedAt?: string;
  lastTestMessage?: string;
  updatedAt?: string;
}

export interface OrganizationSettings {
  orgName: string;
  currency: string;
  timezone: string;
  cutoffDay: number;
  updatedAt?: string;
}
