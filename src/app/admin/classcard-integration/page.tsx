'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';

type Settings = { baseUrl: string; apiKey: string; syncIntervalMinutes: number; enabled: boolean; isConfigured: boolean };
type Tab = 'sync' | 'logs' | 'single' | 'apis' | 'settings';
type ApiKey = 'staffOneOnOneServices' | 'staffEvents' | 'staffServices' | 'inventoryProducts' | 'students' | 'studentEvents' | 'studentDetails' | 'studentInvoices' | 'events' | 'attendance' | 'invoices';
type RecordOption = { id: string; label: string; externalId?: string };
const apiDefinitions: Array<{ id: ApiKey; label: string; description: string; fields: Array<{ name: string; label: string; type?: string; required?: boolean; hint?: string; source?: 'subject' }> }> = [
  { id: 'staffOneOnOneServices', label: 'Staff One-on-One services', description: 'Subject and duration combinations bookable for a mentor.', fields: [{ name: 'staff_id', label: 'Mentor', required: true }] },
  { id: 'staffEvents', label: 'Staff events', description: 'Events for a mentor within a date range.', fields: [{ name: 'staff', label: 'Mentor', required: true }, { name: 'start', label: 'Start date', type: 'date', required: true }, { name: 'end', label: 'End date', type: 'date', required: true }, { name: 'subject', label: 'Subject (optional)', source: 'subject' }] },
  { id: 'staffServices', label: 'Staff services', description: 'Subject services available to a mentor.', fields: [{ name: 'staff_id', label: 'Mentor', required: true }] },
  { id: 'inventoryProducts', label: 'Product inventory', description: 'Paginated customer-facing products and variations.', fields: [{ name: 'status', label: 'Status', hint: '0 = active' }, { name: 'order_by', label: 'Order JSON', hint: '{"field":"product_id","direction":"desc"}' }, { name: 'search', label: 'Search' }, { name: 'per_page', label: 'Per page', hint: '1–100' }] },
  { id: 'students', label: 'Students', description: 'Students available through the Classcard public API.', fields: [] },
  { id: 'studentEvents', label: 'Student events', description: 'Events for a selected student.', fields: [{ name: 'student_id', label: 'Student', required: true }] },
  { id: 'studentDetails', label: 'Student details', description: 'Details for a selected student.', fields: [{ name: 'student_id', label: 'Student', required: true }] },
  { id: 'studentInvoices', label: 'Student invoices', description: 'Invoices for a selected student.', fields: [{ name: 'student_id', label: 'Student', required: true }] },
  { id: 'events', label: 'Events', description: 'Events across the academy.', fields: [{ name: 'start', label: 'Start date', type: 'date' }, { name: 'end', label: 'End date', type: 'date' }, { name: 'subject', label: 'Subject (optional)', source: 'subject' }] },
  { id: 'attendance', label: 'Attendance', description: 'Attendance records for a date range.', fields: [{ name: 'start_date', label: 'Start date', type: 'date', required: true }, { name: 'end_date', label: 'End date', type: 'date', required: true }] },
  { id: 'invoices', label: 'Invoices', description: 'Invoice records from Classcard.', fields: [] },
];

export default function ClasscardIntegrationPage() {
  const [tab, setTab] = useState<Tab>('sync');
  const [settings, setSettings] = useState<Settings>({ baseUrl: '', apiKey: '', syncIntervalMinutes: 60, enabled: true, isConfigured: false });
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [staff, setStaff] = useState('');
  const [logs, setLogs] = useState<Array<{ id: string; jobType: string; status: string; recordsProcessed: number; recordsCreated: number; startedAt: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [api, setApi] = useState<ApiKey>('staffOneOnOneServices');
  const [apiParams, setApiParams] = useState<Record<string, string>>({});
  const [apiResult, setApiResult] = useState<unknown>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [mentors, setMentors] = useState<RecordOption[]>([]);
  const [students, setStudents] = useState<RecordOption[]>([]);
  const [subjects, setSubjects] = useState<RecordOption[]>([]);

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
    const [mentorResponse, studentResponse, subjectResponse] = await Promise.all([fetch('/api/records?type=mentor'), fetch('/api/records?type=student'), fetch('/api/records?type=subject')]);
    const mentorData = await mentorResponse.json();
    const studentData = await studentResponse.json();
    const subjectData = await subjectResponse.json();
    if (mentorResponse.ok && mentorData.success) {
      setMentors((mentorData.records || []).filter((record: { externalId?: string }) => record.externalId).map((record: { id: string; firstName: string; lastName: string; externalId?: string }) => ({ id: record.id, label: `${record.firstName} ${record.lastName} · ${record.externalId}`, externalId: record.externalId })));
    }
    if (studentResponse.ok && studentData.success) {
      setStudents((studentData.records || []).filter((record: { externalId?: string }) => record.externalId).map((record: { id: string; firstName: string; lastName: string; externalId?: string }) => ({ id: record.id, label: `${record.firstName} ${record.lastName} · ${record.externalId}`, externalId: record.externalId })));
    }
    if (subjectResponse.ok && subjectData.success) {
      setSubjects((subjectData.records || []).filter((record: { externalId?: string }) => record.externalId).map((record: { id: string; name: string; code: string; externalId?: string }) => ({ id: record.id, label: `${record.name} · ${record.externalId}`, externalId: record.externalId })));
    }
  };

  const selectedApi = apiDefinitions.find((definition) => definition.id === api) || apiDefinitions[0];
  const runApi = async () => {
    setError(null); setMessage(null); setApiResult(null); setApiLoading(true);
    try {
      const params = { ...apiParams };
      const mentorField = selectedApi.fields.find((field) => field.name === 'staff_id' || field.name === 'staff');
      const studentField = selectedApi.fields.find((field) => field.name === 'student_id');
      if (mentorField && params[mentorField.name]) {
        const mentor = mentors.find((option) => option.id === params[mentorField.name]);
        params[mentorField.name] = mentor?.externalId || params[mentorField.name];
      }
      if (studentField && params[studentField.name]) {
        const student = students.find((option) => option.id === params[studentField.name]);
        params[studentField.name] = student?.externalId || params[studentField.name];
      }
      const subjectField = selectedApi.fields.find((field) => field.source === 'subject');
      if (subjectField && params[subjectField.name]) {
        const subject = subjects.find((option) => option.id === params[subjectField.name]);
        params[subjectField.name] = subject?.externalId || params[subjectField.name];
      }
      if (params.order_by) {
        try { params.order_by = JSON.stringify(JSON.parse(params.order_by)); } catch { throw new Error('Order JSON must be valid JSON.'); }
      }
      const response = await fetch('/api/classcard/integration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request-api', api, params }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Classcard API request failed.');
      setApiResult(data.data);
      setMessage('Live Classcard API response received.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Classcard API request failed.');
    } finally { setApiLoading(false); }
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
    <Tabs tabs={[{ id: 'sync', label: 'Sync data' }, { id: 'apis', label: 'Public APIs' }, { id: 'logs', label: 'Sync logs' }, { id: 'single', label: 'Single sync' }, { id: 'settings', label: 'Settings' }]} activeTab={tab} onChange={(value) => setTab(value as Tab)} />
    {tab === 'sync' && <Card><CardHeader title="Sync Classcard sessions" subtitle="Use a date range and optionally a Classcard staff ID." /><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Start date<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm font-medium">End date<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm font-medium">Staff ID (optional)<input value={staff} onChange={(event) => setStaff(event.target.value)} placeholder="Classcard staff ID" className="mt-1 w-full rounded-lg border p-2" /></label></div><Button onClick={() => void sync().catch((syncError: unknown) => setError(syncError instanceof Error ? syncError.message : 'Classcard sync failed.'))}>Fetch and save sessions</Button></CardContent></Card>}
    {tab === 'single' && <Card><CardHeader title="Single sync" subtitle="Run one staff/date-range request without changing automatic settings." /><CardContent><p className="text-sm text-slate-600">Enter a staff ID above in Sync data and use the same event endpoint for a targeted sync.</p></CardContent></Card>}
    {tab === 'apis' && <Card><CardHeader title="Classcard public APIs" subtitle="Choose an API, provide its parameters, and run a live request. API credentials remain server-side." /><CardContent className="space-y-4">
      <label className="block text-sm font-medium">API endpoint<select value={api} onChange={(event) => { setApi(event.target.value as ApiKey); setApiParams({}); setApiResult(null); }} className="mt-1 w-full rounded-lg border p-2">{apiDefinitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.label}</option>)}</select></label>
      <p className="text-sm text-slate-600">{selectedApi.description}</p>
      <div className="grid gap-4 md:grid-cols-2">{selectedApi.fields.map((field) => <label key={field.name} className="text-sm font-medium">{field.label}{field.required && <span className="text-rose-500"> *</span>}{(field.name === 'staff_id' || field.name === 'staff') ? <select required={field.required} value={apiParams[field.name] || ''} onChange={(event) => setApiParams({ ...apiParams, [field.name]: event.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="">Select a mentor</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.label}</option>)}</select> : field.name === 'student_id' ? <select required={field.required} value={apiParams[field.name] || ''} onChange={(event) => setApiParams({ ...apiParams, [field.name]: event.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="">Select a student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</select> : field.source === 'subject' ? <select value={apiParams[field.name] || ''} onChange={(event) => setApiParams({ ...apiParams, [field.name]: event.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select> : <input required={field.required} type={field.type || 'text'} value={apiParams[field.name] || ''} placeholder={field.hint} onChange={(event) => setApiParams({ ...apiParams, [field.name]: event.target.value })} className="mt-1 w-full rounded-lg border p-2" />}</label>)}</div>
      <Button onClick={() => void runApi()} disabled={apiLoading}>{apiLoading ? 'Requesting…' : 'Run live API request'}</Button>
      {apiResult !== null && <pre className="max-h-[32rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-emerald-300">{JSON.stringify(apiResult, null, 2)}</pre>}
    </CardContent></Card>}
    {tab === 'logs' && <Card><CardHeader title="Sync logs" subtitle="Recent production synchronization runs." /><CardContent className="space-y-2">{logs.map((log) => <div key={log.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{log.jobType} · {log.status}</span><span>{log.recordsCreated}/{log.recordsProcessed} saved · {new Date(log.startedAt).toLocaleString()}</span></div>)}{logs.length === 0 && <p className="text-sm text-slate-500">No sync runs recorded yet.</p>}</CardContent></Card>}
    {tab === 'settings' && <Card><CardHeader title="Classcard API settings" subtitle="The API key is encrypted at rest and never returned in full." /><CardContent className="space-y-4"><label className="block text-sm font-medium">API base URL<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm font-medium">API key<input value={settings.apiKey} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} placeholder="Enter a new key to replace the current key" className="mt-1 w-full rounded-lg border p-2" /></label><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Sync interval (minutes)<input type="number" min={5} value={settings.syncIntervalMinutes} onChange={(event) => setSettings({ ...settings, syncIntervalMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-lg border p-2" /><span className="mt-1 block text-xs font-normal text-slate-500">Vercel Hobby runs this integration once daily. Use Vercel Pro or an external scheduler for intervals shorter than 24 hours.</span></label><label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /> Automatic sync enabled</label></div><Button onClick={() => void saveSettings().catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : 'Unable to save settings.'))}>Save settings</Button></CardContent></Card>}
  </div></AppShell>;
}
