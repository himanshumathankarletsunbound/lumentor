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

export default function FetchDataPage() {
  const [tab, setTab] = useState<'events' | 'attendance'>('events');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mode, setMode] = useState<'all' | 'selected'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [progressCurrentMentor, setProgressCurrentMentor] = useState('');
  const [progressCompletedMentors, setProgressCompletedMentors] = useState(0);
  const [progressTotalMentors, setProgressTotalMentors] = useState(0);
  const [progressFailedMentors, setProgressFailedMentors] = useState(0);
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
    const timer = window.setTimeout(() => {
      const currentDate = new Date().toISOString().slice(0, 10);
      setStart(currentDate);
      setEnd(currentDate);
      void loadMentors().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load mentors.' }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const run = async (action: 'fetch-events' | 'fetch-attendance') => {
    if (!start || !end || start > end) { setNotice({ type: 'error', message: 'Choose a valid start and end date.' }); return; }
    if (mode === 'selected' && selected.length === 0) { setNotice({ type: 'error', message: 'Select at least one mentor, or choose All Mentors.' }); return; }
    setLoading(true); setNotice(null); setSummary(null); setProgress(0);
    setProgressCurrentMentor(''); setProgressCompletedMentors(0); setProgressTotalMentors(0); setProgressFailedMentors(0);
    try {
      if (action === 'fetch-events') {
        const chosenMentors = (mode === 'all' ? eligible : eligible.filter((mentor) => selected.includes(mentor.id)));
        const uniqueByClasscardId = new Map<string, Mentor>();
        for (const mentor of chosenMentors) {
          const classcardId = mentor.externalId?.trim();
          if (classcardId && !uniqueByClasscardId.has(classcardId)) uniqueByClasscardId.set(classcardId, mentor);
        }
        const mentorsToFetch = [...uniqueByClasscardId.values()];
        if (!mentorsToFetch.length) throw new Error('No selected mentors have Classcard IDs.');
        setProgressTotalMentors(mentorsToFetch.length);
        setProgressLabel('Preparing mentor event requests…');
        const eventById = new Map<string, EventRow>();
        const failures: Array<{ mentorId: string; mentorName: string; error: string }> = [];
        let fetchedEvents = 0;
        let saved = 0;
        let materialized = 0;
        let missingSubject = 0;
        let unmappedMentor = 0;
        for (let index = 0; index < mentorsToFetch.length; index += 1) {
          const mentor = mentorsToFetch[index];
          const mentorName = `${mentor.firstName} ${mentor.lastName}`.trim();
          setProgressCurrentMentor(mentorName);
          setProgressLabel(`Fetching events for ${mentorName}…`);
          setProgress(Math.round((index / mentorsToFetch.length) * 100));
          try {
            const response = await fetch('/api/classcard/integration', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'fetch-events', start, end, mentorIds: [mentor.id] }),
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Classcard fetch failed.');
            for (const event of payload.events || []) if (event.externalId && !eventById.has(event.externalId)) eventById.set(event.externalId, event);
            fetchedEvents += Number(payload.summary?.fetchedEvents || 0);
            saved += Number(payload.summary?.saved || 0);
            materialized += Number(payload.summary?.materialized || 0);
            missingSubject += Number(payload.summary?.missingSubject || 0);
            unmappedMentor += Number(payload.summary?.unmappedMentor || 0);
          } catch (error) {
            failures.push({ mentorId: mentor.id, mentorName, error: error instanceof Error ? error.message : 'Classcard request failed.' });
            setProgressFailedMentors(failures.length);
          } finally {
            const completed = index + 1;
            setProgressCompletedMentors(completed);
            setProgress(Math.round((completed / mentorsToFetch.length) * 100));
          }
        }
        const uniqueEvents = eventById.size;
        setEvents([...eventById.values()]);
        setSummary({ mentorsProcessed: mentorsToFetch.length, fetchedEvents, uniqueEvents, duplicatesIgnored: Math.max(0, fetchedEvents - uniqueEvents), saved, materialized, missingSubject, unmappedMentor, failedMentorRequests: failures.length, failures });
        setProgressCurrentMentor('');
        setProgressLabel(failures.length ? 'Event fetch completed with some mentor request failures.' : 'Events fetched and matched.');
        setNotice({ type: failures.length ? 'error' : 'success', message: `Fetched ${uniqueEvents} unique events across ${mentorsToFetch.length} mentor${mentorsToFetch.length === 1 ? '' : 's'}.` });
      } else {
        const chosenMentors = mode === 'all' ? eligible : eligible.filter((mentor) => selected.includes(mentor.id));
        const uniqueByClasscardId = new Map<string, Mentor>();
        for (const mentor of chosenMentors) {
          const classcardId = mentor.externalId?.trim();
          if (classcardId && !uniqueByClasscardId.has(classcardId)) uniqueByClasscardId.set(classcardId, mentor);
        }
        const mentorsToProcess = [...uniqueByClasscardId.values()];
        if (!mentorsToProcess.length) throw new Error('No selected mentors have Classcard IDs.');
        setProgressLabel('Fetching attendance source data from Classcard…');
        setProgress(5);
        const stageResponse = await fetch('/api/classcard/integration', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stage-attendance', start, end }),
        });
        const staged = await stageResponse.json();
        if (!stageResponse.ok || !staged.success || !staged.importId) throw new Error(staged.error || 'Unable to fetch attendance from Classcard.');
        setProgressTotalMentors(mentorsToProcess.length);
        const attendanceByKey = new Map<string, AttendanceRow>();
        const failures: Array<{ mentorId: string; mentorName: string; error: string }> = [];
        let mapped = 0;
        let unmatchedEvents = 0;
        let unmatchedStudents = 0;
        for (let index = 0; index < mentorsToProcess.length; index += 1) {
          const mentor = mentorsToProcess[index];
          const mentorName = `${mentor.firstName} ${mentor.lastName}`.trim();
          setProgressCurrentMentor(mentorName);
          setProgressLabel(`Matching attendance for ${mentorName}…`);
          setProgress(5 + Math.round((index / mentorsToProcess.length) * 95));
          try {
            const response = await fetch('/api/classcard/integration', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'fetch-attendance', start, end, mentorIds: [mentor.id], importId: staged.importId }),
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Attendance matching failed.');
            for (const row of payload.attendance || []) {
              const key = `${row.eventId}:${row.studentExternalId}:${row.status}`;
              if (!attendanceByKey.has(key)) attendanceByKey.set(key, row);
            }
            mapped += Number(payload.summary?.mapped || 0);
            unmatchedEvents += Number(payload.summary?.events || 0);
            unmatchedStudents += Number(payload.summary?.students || 0);
          } catch (error) {
            failures.push({ mentorId: mentor.id, mentorName, error: error instanceof Error ? error.message : 'Attendance matching failed.' });
            setProgressFailedMentors(failures.length);
          } finally {
            const completed = index + 1;
            setProgressCompletedMentors(completed);
            setProgress(5 + Math.round((completed / mentorsToProcess.length) * 95));
          }
        }
        setAttendance([...attendanceByKey.values()]);
        setSummary({ mentorsProcessed: mentorsToProcess.length, fetched: Number(staged.fetchedRows || 0), mapped, unmatchedEvents, unmatchedStudents, failedMentorRequests: failures.length, failures });
        setProgressCurrentMentor('');
        setProgressLabel(failures.length ? 'Attendance fetch completed with some mentor matching failures.' : 'Attendance fetched and matched.');
        setNotice({ type: failures.length ? 'error' : 'success', message: `Fetched ${Number(staged.fetchedRows || 0)} attendance records and processed ${mentorsToProcess.length} mentor${mentorsToProcess.length === 1 ? '' : 's'}.` });
      }
      setProgress(100);
    } catch (error) {
      setProgress(0);
      setProgressLabel(''); setProgressCurrentMentor('');
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
    {(loading || progress > 0) && <Card><CardContent className="space-y-3 p-4"><div className="flex items-center justify-between text-sm font-medium text-slate-700"><span>{progressLabel || 'Ready'}</span><span>{progress}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`${tab === 'events' ? 'Events' : 'Attendance'} fetch progress`}><div className={`h-full rounded-full transition-all duration-500 ${loading ? 'animate-pulse bg-indigo-600' : 'bg-emerald-600'}`} style={{ width: `${progress}%` }} /></div>{progressTotalMentors > 0 ? <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3"><div><p className="text-slate-500">Mentors completed</p><p className="mt-0.5 font-semibold text-slate-800">{progressCompletedMentors} of {progressTotalMentors}</p></div><div><p className="text-slate-500">{tab === 'events' ? 'Currently fetching' : 'Currently matching'}</p><p className="mt-0.5 truncate font-semibold text-slate-800">{progressCurrentMentor || (loading ? 'Finishing…' : 'Completed')}</p></div><div><p className="text-slate-500">Failed requests</p><p className={`mt-0.5 font-semibold ${progressFailedMentors ? 'text-rose-700' : 'text-slate-800'}`}>{progressFailedMentors}</p></div></div> : null}<p className="text-xs text-slate-500">{loading ? (tab === 'events' ? 'Each Classcard staff request is completed before the next mentor starts.' : 'Classcard attendance is fetched once, then securely matched one mentor at a time.') : 'Fetch complete.'}</p></CardContent></Card>}
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
