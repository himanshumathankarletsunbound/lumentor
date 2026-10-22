'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/Card';

interface EmailSettings {
  user: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  isEnabled: boolean;
  oauthConfigured: boolean;
  oauthConnected: boolean;
  oauthClientId: string;
  lastTestStatus?: string;
  lastTestMessage?: string;
}

export function GoogleWorkspaceEmailSettings() {
  const [settings, setSettings] = useState<EmailSettings>({
    user: '',
    fromEmail: '',
    fromName: 'LUmentor Notifications',
    isEnabled: false,
    oauthConfigured: false,
    oauthConnected: false,
    oauthClientId: '',
  });
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    try {
      const response = await fetch('/api/settings/email');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load email settings.');
      setSettings((current) => ({ ...current, ...data.emailConfig }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load email settings.');
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const save = async (isEnabled = settings.isEnabled) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, isEnabled }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to save email settings.');
      setSettings((current) => ({ ...current, ...data.emailConfig }));
      setMessage('Google Workspace outbound email settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save email settings.');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, to: recipient || settings.user }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Email test failed.');
      setMessage(data.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email test failed.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && <Alert variant="success" title="Email" message={message} />}
      {error && <Alert variant="danger" title="Email configuration error" message={error} />}
      <Card>
        <CardHeader
          title="Google Workspace outbound email"
          subtitle="LUmentor sends email only. It does not read or receive mail."
        />
        <CardContent className="space-y-4 text-xs">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-indigo-950">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              OAuth is the only supported authentication method
            </div>
            <p className="mt-1 leading-relaxed">
              No SMTP password, app password, or incoming-mail integration is used. Authorize the Google Workspace mailbox and LUmentor stores only its encrypted OAuth refresh token on the server.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="font-semibold text-slate-700">
              Google Workspace email
              <input
                type="email"
                value={settings.user}
                onChange={(event) => setSettings({ ...settings, user: event.target.value, fromEmail: settings.fromEmail || event.target.value })}
                placeholder="notifications@yourdomain.com"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal text-slate-900"
              />
            </label>
            <label className="font-semibold text-slate-700">
              From email
              <input
                type="email"
                value={settings.fromEmail}
                onChange={(event) => setSettings({ ...settings, fromEmail: event.target.value })}
                placeholder="notifications@yourdomain.com"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal text-slate-900"
              />
            </label>
            <label className="font-semibold text-slate-700">
              Sender name
              <input
                type="text"
                value={settings.fromName}
                onChange={(event) => setSettings({ ...settings, fromName: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal text-slate-900"
              />
            </label>
            <label className="font-semibold text-slate-700">
              Reply-to (optional)
              <input
                type="email"
                value={settings.replyTo || ''}
                onChange={(event) => setSettings({ ...settings, replyTo: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal text-slate-900"
              />
            </label>
          </div>

          <div className={`rounded-lg border p-3 ${settings.oauthConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <strong>{settings.oauthConnected ? 'Google Workspace connected' : 'Google Workspace not connected'}</strong>
            <p className="mt-1">
              {settings.oauthConfigured ? 'OAuth client configuration is ready.' : 'Set the server-side Google OAuth environment variables before connecting.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/api/settings/email/oauth/authorize">
              <Button type="button" variant="primary" leftIcon={<ShieldCheck className="h-4 w-4" />}>
                {settings.oauthConnected ? 'Reconnect Google Workspace' : 'Connect Google Workspace'}
              </Button>
            </a>
            <Button type="button" variant="outline" isLoading={saving} onClick={() => void save()} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Save settings
            </Button>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 font-semibold text-slate-700">
            <input type="checkbox" checked={settings.isEnabled} onChange={(event) => setSettings({ ...settings, isEnabled: event.target.checked })} className="mt-0.5" />
            <span>
              Enable outbound email
              <span className="mt-1 block font-normal text-slate-500">Used for invitations, password resets, and operational notifications. No incoming mail is accessed.</span>
            </span>
          </label>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex-1 font-semibold text-slate-700">
            Send a test to
            <input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={settings.user || 'recipient@example.com'} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal text-slate-900" />
          </label>
          <Button type="button" variant="outline" isLoading={testing} onClick={() => void test()} leftIcon={<Send className="h-4 w-4" />}>
            Send test email
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
