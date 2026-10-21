export type EmailSecurity = 'STARTTLS' | 'SSL_TLS' | 'NONE';

export interface EmailConfig {
  host: string;
  port: number;
  security: EmailSecurity;
  authRequired: boolean;
  user: string;
  pass: string;
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
