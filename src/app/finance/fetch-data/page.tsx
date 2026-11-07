'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table';
import { Tabs } from '../../../components/ui/Tabs';
import { CalendarClock, RefreshCw, Search, Users } from 'lucide-react';

type Mentor = { id: string; firstName: string; lastName: string; externalId?: string };
type EventRow = { externalId: string; title: string; mentorNames: string[]; studentIds: string[]; startTime: string; endTime: string; subjectName: string; classId: string; attendanceStatus: string; locationName: string; timezoneName: string };
type AttendanceRow = { eventId: string; studentExternalId: string; status: string; mapped: boolean; reason?: string };
type Notice = { type: 'success' | 'error'; message: string };

const today = () => new Date().toISOString().slice(0, 10);

export default function FetchDataPage() {
  const [tab, setTab] = useState<'events' | 'attendance'>('events');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mode, setMode] = useState<'all' | 'selected'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  const eligible = useMemo(() => mentors.filter((mentor) => Boolean(mentor.externalId?.trim())), [mentors]);
  const visibleMentors = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return eligible.filter((mentor) => !needle || `${mentor.firstName} ${mentor.lastName} ${mentor.id} ${mentor.externalId}`.toLowerCase().includes(needle));
  }, [eligible, query]);

  const loadMentors = async () => {
    const response = await fetch('/api/records?type=mentor');
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load mentors.');
    setMentors(payload.records || []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMentors().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load mentors.' })), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const mentorIds = mode === 'all' ? [] : selected;
  const run = async (action: 'fetch-events' | 'fetch-attendance') => {
    if (!start || !end || start > end) { setNotice({ type: 'error', message: 'Choose a valid start and end date.' }); return; }
    if (mode === 'selected' && selected.length === 0) { setNotice({ type: 'error', message: 'Select at least one mentor, or choose All Mentors.' }); return; }
    setLoading(true); setNotice(null); setSummary(null);
    try {
      const response = await fetch('/api/classcard/integration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, start, end, mentorIds }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Classcard fetch failed.');
      setSummary(payload.summary || null);
      if (action === 'fetch-events') setEvents(payload.events || []);
      else setAttendance(payload.attendance || []);
      setNotice({ type: 'success', message: action === 'fetch-events' ? `Fetched ${payload.summary?.uniqueEvents || 0} unique events.` : `Fetched ${payload.summary?.fetched || 0} attendance records.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Classcard fetch failed.' });
    } finally { setLoading(false); }
  };

  const toggleMentor = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const statEntries = summary ? Object.entries(summary).filter(([, value]) => typeof value === 'number') : [];
  const failures = Array.isArray(summary?.failures) ? summary.failures.filter((value): value is { mentorName?: string; error?: string } => Boolean(value && typeof value === 'object')) : [];

  return <AppShell><div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Fetch Data</h1><p className="mt-1 text-sm text-slate-500">Fetch Classcard events and attendance securely, then match them to existing records.</p></div><Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadMentors().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to refresh mentors.' }))}>Refresh mentors</Button></div>
    {notice && <Alert type={notice.type} title={notice.type === 'error' ? 'Fetch failed' : 'Fetch complete'} message={notice.message} />}
    <Tabs tabs={[{ id: 'events', label: 'Fetch Events', icon: <CalendarClock className="h-4 w-4" /> }, { id: 'attendance', label: 'Fetch Attendance', icon: <Users className="h-4 w-4" /> }]} activeTab={tab} onChange={(value) => setTab(value as 'events' | 'attendance')} />
    <Card><CardHeader title={tab === 'events' ? 'Event fetch parameters' : 'Attendance fetch parameters'} subtitle={tab === 'events' ? 'Classcard staff events are requested per selected mentor. Subject IDs are never required.' : 'Classcard attendance is fetched by date range and optionally filtered through already-fetched mentor events.'} /><CardContent className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Start date<input className="mt-1 w-full rounded-lg border border-slate-200 p-2" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label className="text-sm font-medium text-slate-700">End date<input className="mt-1 w-full rounded-lg border border-slate-200 p-2" type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div>
      <div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-800">Staff selection</p><div className="mt-3 flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} /> All Mentors <span className="text-slate-500">({eligible.length} with Classcard IDs)</span></label><label className="flex items-center gap-2"><input type="radio" checked={mode === 'selected'} onChange={() => setMode('selected')} /> Select Mentors</label></div>
        {mode === 'selected' && <div className="mt-4"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, internal ID, or Classcard ID" /></div><div className="mt-2 max-h-48 divide-y overflow-y-auto rounded-lg border border-slate-200">{visibleMentors.map((mentor) => <label key={mentor.id} className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-slate-50"><input type="checkbox" checked={selected.includes(mentor.id)} onChange={() => toggleMentor(mentor.id)} /><span className="flex-1 font-medium">{mentor.firstName} {mentor.lastName}</span><span className="text-xs text-slate-500">{mentor.id} · Classcard {mentor.externalId}</span></label>)}{visibleMentors.length === 0 && <p className="p-3 text-sm text-slate-500">No eligible mentors found. Add Classcard IDs to mentor records first.</p>}</div></div>}
      </div>
      <Button leftIcon={<RefreshCw className="h-4 w-4" />} disabled={loading || eligible.length === 0} onClick={() => void run(tab === 'events' ? 'fetch-events' : 'fetch-attendance')}>{loading ? 'Fetching…' : tab === 'events' ? 'Fetch Events' : 'Fetch Attendance'}</Button>
    </CardContent></Card>
    {summary && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{statEntries.map(([label, value]) => <Card key={label}><CardContent className="py-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label.replace(/([A-Z])/g, ' $1')}</p><p className="mt-1 text-2xl font-bold text-slate-900">{String(value)}</p></CardContent></Card>)}</div>}
    {failures.length > 0 && <Alert type="warning" title="Some mentor requests failed" message={failures.map((failure) => `${failure.mentorName || 'Mentor'}: ${failure.error || 'Request failed.'}`).join(' ')} />}
    {tab === 'events' && <Card><CardHeader title="Fetched events" subtitle="Duplicate IDs are ignored. Events without a local subject stay staged for mapping instead of being discarded." /><CardContent>{events.length ? <Table><TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Mentor</TableHead><TableHead>Students</TableHead><TableHead>Schedule</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{events.map((event) => <TableRow key={event.externalId}><TableCell><p className="font-medium">{event.title}</p><p className="text-xs text-slate-500">{event.externalId}{event.classId ? ` · ${event.classId}` : ''}</p></TableCell><TableCell>{event.mentorNames.join(', ') || <span className="text-amber-700">Unmapped</span>}</TableCell><TableCell>{event.studentIds.length}</TableCell><TableCell><p>{event.startTime ? new Date(event.startTime).toLocaleString() : 'Unknown'}</p><p className="text-xs text-slate-500">{event.endTime ? new Date(event.endTime).toLocaleString() : ''}</p></TableCell><TableCell>{event.subjectName || <span className="text-amber-700">Not Configured</span>}</TableCell><TableCell><Badge size="sm" variant={event.attendanceStatus ? 'info' : 'default'}>{event.attendanceStatus || 'Pending'}</Badge></TableCell></TableRow>)}</TableBody></Table> : <p className="py-8 text-center text-sm text-slate-500">Fetch events to inspect the results.</p>}</CardContent></Card>}
    {tab === 'attendance' && <Card><CardHeader title="Fetched attendance" subtitle="Rows that cannot be matched to an event or existing student remain visible for review." /><CardContent>{attendance.length ? <Table><TableHeader><TableRow><TableHead>Event ID</TableHead><TableHead>Student Classcard ID</TableHead><TableHead>Status</TableHead><TableHead>Sync status</TableHead></TableRow></TableHeader><TableBody>{attendance.map((row, index) => <TableRow key={`${row.eventId}:${row.studentExternalId}:${index}`}><TableCell>{row.eventId || 'Missing'}</TableCell><TableCell>{row.studentExternalId || 'Missing'}</TableCell><TableCell>{row.status}</TableCell><TableCell><Badge size="sm" variant={row.mapped ? 'success' : 'warning'}>{row.mapped ? 'Mapped' : row.reason || 'Review required'}</Badge></TableCell></TableRow>)}</TableBody></Table> : <p className="py-8 text-center text-sm text-slate-500">Fetch attendance to inspect the results.</p>}</CardContent></Card>}
  </div></AppShell>;
}
