'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';

type Settings = { baseUrl: string; apiKey: string; syncIntervalMinutes: number; enabled: boolean; isConfigured: boolean };
type Tab = 'sync' | 'logs' | 'single' | 'settings';

export default function ClasscardIntegrationPage() {
  const [tab, setTab] = useState<Tab>('sync');
  const [settings, setSettings] = useState<Settings>({ baseUrl: '', apiKey: '', syncIntervalMinutes: 60, enabled: true, isConfigured: false });
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [staff, setStaff] = useState('');
  const [logs, setLogs] = useState<Array<{ id: string; jobType: string; status: string; recordsProcessed: number; recordsCreated: number; startedAt: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [settingsResponse, logsResponse] = await Promise.all([
      fetch('/api/classcard/integration'),
      fetch('/api/classcard/integration?mode=logs'),
    ]);
    const settingsData = await settingsResponse.json();
    const logsData = await logsResponse.json();
    if (!settingsResponse.ok || !settingsData.success) throw new Error(settingsData.error || 'Unable to load Classcard settings.');
    setSettings((current) => ({ ...current, ...settingsData.settings }));
    if (logsResponse.ok && logsData.success) setLogs(logsData.logs || []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = new Date().toISOString().slice(0, 10);
      setStart(today);
      setEnd(today);
      void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load Classcard integration.'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const sync = async () => {
    setError(null); setMessage(null);
    const response = await fetch('/api/classcard/integration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync-events', start, end, staff }) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Classcard sync failed.');
    setMessage(`Fetched ${data.fetched} events and saved ${data.saved}.`);
    await load();
  };

  const saveSettings = async () => {
    setError(null); setMessage(null);
    const response = await fetch('/api/classcard/integration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-settings', ...settings }) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to save settings.');
    setSettings((current) => ({ ...current, ...data.settings }));
    setMessage('Classcard settings saved securely.');
  };

  return <AppShell><div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Classcard Integration</h1><p className="mt-1 text-sm text-slate-500">Fetch and store Classcard sessions and attendance using the configured production API.</p></div>
    {error && <Alert type="error" title="Classcard integration error" message={error} />}
    {message && <Alert type="success" title="Classcard integration" message={message} />}
    <Tabs tabs={[{ id: 'sync', label: 'Sync data' }, { id: 'logs', label: 'Sync logs' }, { id: 'single', label: 'Single sync' }, { id: 'settings', label: 'Settings' }]} activeTab={tab} onChange={(value) => setTab(value as Tab)} />
    {tab === 'sync' && <Card><CardHeader title="Sync Classcard sessions" subtitle="Use a date range and optionally a Classcard staff ID." /><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Start date<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm font-medium">End date<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm font-medium">Staff ID (optional)<input value={staff} onChange={(event) => setStaff(event.target.value)} placeholder="Classcard staff ID" className="mt-1 w-full rounded-lg border p-2" /></label></div><Button onClick={() => void sync().catch((syncError: unknown) => setError(syncError instanceof Error ? syncError.message : 'Classcard sync failed.'))}>Fetch and save sessions</Button></CardContent></Card>}
    {tab === 'single' && <Card><CardHeader title="Single sync" subtitle="Run one staff/date-range request without changing automatic settings." /><CardContent><p className="text-sm text-slate-600">Enter a staff ID above in Sync data and use the same event endpoint for a targeted sync.</p></CardContent></Card>}
    {tab === 'logs' && <Card><CardHeader title="Sync logs" subtitle="Recent production synchronization runs." /><CardContent className="space-y-2">{logs.map((log) => <div key={log.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{log.jobType} · {log.status}</span><span>{log.recordsCreated}/{log.recordsProcessed} saved · {new Date(log.startedAt).toLocaleString()}</span></div>)}{logs.length === 0 && <p className="text-sm text-slate-500">No sync runs recorded yet.</p>}</CardContent></Card>}
    {tab === 'settings' && <Card><CardHeader title="Classcard API settings" subtitle="The API key is encrypted at rest and never returned in full." /><CardContent className="space-y-4"><label className="block text-sm font-medium">API base URL<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm font-medium">API key<input value={settings.apiKey} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} placeholder="Enter a new key to replace the current key" className="mt-1 w-full rounded-lg border p-2" /></label><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Sync interval (minutes)<input type="number" min={5} value={settings.syncIntervalMinutes} onChange={(event) => setSettings({ ...settings, syncIntervalMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /> Automatic sync enabled</label></div><Button onClick={() => void saveSettings().catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Unable to save settings.'))}>Save settings</Button></CardContent></Card>}
  </div></AppShell>;
}
