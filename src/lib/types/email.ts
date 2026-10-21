export type EmailSecurity = 'STARTTLS' | 'SSL_TLS' | 'NONE';
export type EmailAuthType = 'PASSWORD' | 'OAUTH2';

export interface EmailConfig {
  host: string;
  port: number;
  security: EmailSecurity;
  authType?: EmailAuthType; // 'PASSWORD' or 'OAUTH2'
  authRequired: boolean;
  user: string;
  pass: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthRefreshToken?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  allowSelfSignedCert: boolean;
  isEnabled: boolean;
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
