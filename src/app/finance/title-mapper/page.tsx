'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table';
import { Check, ChevronLeft, ChevronRight, Eye, RefreshCw, Search } from 'lucide-react';

type Plan = { id: string; name: string; code: string };
type Mentor = { id: string; firstName: string; lastName: string };
type ClassRow = { classId: string | null; title: string; titles: string[]; eventCount: number; mentors: Array<{ id: string; name: string }>; studentCount: number; firstSession: string; lastSession: string; subjectIds: string[]; subjectNames: string[]; mappingStatus: 'MAPPED' | 'UNMAPPED' | 'NEEDS_REVIEW'; payrollPlan: Plan | null };
type Detail = { classId: string; mapping: { payrollPlanId: string | null; status: string; displayTitle: string | null } | null; events: Array<{ externalId: string; title: string; startTime: string; endTime: string; subjectExternalId: string | null; subjectName: string | null; mentor: string | null; studentIds: string[] }> };

export default function TitleMapperPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState({ total: 0, mapped: 0, unmapped: 0, needsReview: 0, missingClassId: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [payrollPlanId, setPayrollPlanId] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: '25' });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (payrollPlanId) params.set('payrollPlanId', payrollPlanId);
      if (mentorId) params.set('mentorId', mentorId);
      const [classesResponse, plansResponse, mentorsResponse] = await Promise.all([fetch(`/api/classcard/title-mapper?${params}`), fetch('/api/payroll-plans'), fetch('/api/records?type=mentor')]);
      const classesPayload = await classesResponse.json();
      const plansPayload = await plansResponse.json();
      if (!classesResponse.ok || !classesPayload.success) throw new Error(classesPayload.error || 'Unable to load Classcard classes.');
      setRows(classesPayload.rows || []); setSummary(classesPayload.summary); setTotal(classesPayload.total); setPage(classesPayload.page);
      if (plansResponse.ok && plansPayload.success) setPlans((plansPayload.plans || []).filter((plan: Plan & { isActive?: boolean }) => plan.isActive !== false));
      if (mentorsResponse.ok) {
        const mentorsPayload = await mentorsResponse.json();
        if (mentorsPayload.success) setMentors(mentorsPayload.records || []);
      }
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load title mappings.' }); }
    finally { setLoading(false); }
  }, [mentorId, payrollPlanId, search, status]);

  useEffect(() => { const timer = window.setTimeout(() => void load(1), 0); return () => window.clearTimeout(timer); }, [load]);

  const openDetail = async (row: ClassRow) => {
    if (!row.classId) { setNotice({ type: 'error', message: 'This event is missing gibbonCourseClassID and cannot be mapped. Review its source event data.' }); return; }
    const response = await fetch(`/api/classcard/title-mapper?classId=${encodeURIComponent(row.classId)}`);
    const payload = await response.json();
    if (!response.ok || !payload.success) { setNotice({ type: 'error', message: payload.error || 'Unable to load class details.' }); return; }
    setDetail(payload.detail); setSelectedPlanId(payload.detail.mapping?.payrollPlanId || row.payrollPlan?.id || '');
  };

  const saveMapping = async () => {
    if (!detail || !selectedPlanId) return;
    setSaving(true);
    try {
      const row = rows.find((item) => item.classId === detail.classId);
      const response = await fetch('/api/classcard/title-mapper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: detail.classId, payrollPlanId: selectedPlanId, displayTitle: row?.title || detail.events[0]?.title || '' }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save payroll-plan mapping.');
      setNotice({ type: 'success', message: `Saved payroll-plan mapping for Classcard class ${detail.classId}.` }); setDetail(null); await load(page);
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save mapping.' }); }
    finally { setSaving(false); }
  };

  const pageCount = Math.max(1, Math.ceil(total / 25));
  const metrics = [['Unique classes', summary.total], ['Mapped', summary.mapped], ['Unmapped', summary.unmapped], ['Needs review', summary.needsReview], ['Missing class ID', summary.missingClassId]];
  return <AppShell><div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Title Mapper</h1><p className="mt-1 text-sm text-slate-500">Manually map each unique Classcard class to one payroll plan. No title inference is performed.</p></div><Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void load(page)}>Refresh</Button></div>
    {notice && <Alert type={notice.type} title={notice.type === 'error' ? 'Title Mapper' : 'Mapping saved'} message={notice.message} />}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{metrics.map(([label, value]) => <Card key={String(label)}><CardContent className="py-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader title="Classcard classes" subtitle="Rows are grouped by gibbonCourseClassID. Events with no class ID are retained as review-only records." /><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-5"><label className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Classcard class ID or title" /></label><select className="rounded-lg border border-slate-200 p-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="MAPPED">Mapped</option><option value="UNMAPPED">Unmapped</option><option value="NEEDS_REVIEW">Needs review</option></select><select className="rounded-lg border border-slate-200 p-2 text-sm" value={mentorId} onChange={(event) => setMentorId(event.target.value)}><option value="">All mentors</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.firstName} {mentor.lastName}</option>)}</select><select className="rounded-lg border border-slate-200 p-2 text-sm" value={payrollPlanId} onChange={(event) => setPayrollPlanId(event.target.value)}><option value="">All payroll plans</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.code}</option>)}</select></div><Button size="sm" leftIcon={<Search className="h-4 w-4" />} onClick={() => void load(1)}>Apply filters</Button>
      {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading unique Classcard classes…</p> : <Table><TableHeader><TableRow><TableHead>Classcard Class ID</TableHead><TableHead>Class title</TableHead><TableHead>Events</TableHead><TableHead>Mentors / students</TableHead><TableHead>Session range</TableHead><TableHead>Payroll plan</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={row.classId || `missing-${index}`}><TableCell className="font-mono text-xs">{row.classId || <span className="font-sans text-amber-700">Missing — review</span>}</TableCell><TableCell><p className="font-medium">{row.title}</p>{row.titles.length > 1 && <p className="text-xs text-amber-700">{row.titles.length} conflicting titles</p>}</TableCell><TableCell>{row.eventCount}</TableCell><TableCell><p>{row.mentors.map((mentor) => mentor.name).join(', ') || 'Unmapped'}</p><p className="text-xs text-slate-500">{row.studentCount} student{row.studentCount === 1 ? '' : 's'}</p></TableCell><TableCell><p>{new Date(row.firstSession).toLocaleDateString()}</p><p className="text-xs text-slate-500">to {new Date(row.lastSession).toLocaleDateString()}</p></TableCell><TableCell>{row.payrollPlan ? `${row.payrollPlan.name} · ${row.payrollPlan.code}` : '—'}</TableCell><TableCell><Badge size="sm" variant={row.mappingStatus === 'MAPPED' ? 'success' : row.mappingStatus === 'NEEDS_REVIEW' ? 'warning' : 'default'}>{row.mappingStatus.replace('_', ' ')}</Badge></TableCell><TableCell><Button size="sm" variant="outline" leftIcon={<Eye className="h-4 w-4" />} onClick={() => void openDetail(row)} disabled={!row.classId}>View / assign</Button></TableCell></TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">No stored Classcard events match these filters. Fetch events first.</TableCell></TableRow>}</TableBody></Table>}
      <div className="flex items-center justify-end gap-3 text-sm"><span>Page {page} of {pageCount}</span><Button size="sm" variant="outline" leftIcon={<ChevronLeft className="h-4 w-4" />} disabled={page <= 1} onClick={() => void load(page - 1)}>Previous</Button><Button size="sm" variant="outline" rightIcon={<ChevronRight className="h-4 w-4" />} disabled={page >= pageCount} onClick={() => void load(page + 1)}>Next</Button></div>
    </CardContent></Card>
    <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title="Classcard class details" subtitle={detail?.classId} maxWidth="2xl" footer={<><Button variant="outline" onClick={() => setDetail(null)}>Cancel</Button><Button disabled={!selectedPlanId || saving} leftIcon={<Check className="h-4 w-4" />} onClick={() => void saveMapping()}>{saving ? 'Saving…' : 'Confirm payroll plan'}</Button></>}>
      {detail && <div className="space-y-5"><div><label className="text-sm font-medium text-slate-700">Payroll plan<select className="mt-1 w-full rounded-lg border border-slate-200 p-2" value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}><option value="">Select a payroll plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.code}</option>)}</select></label></div><div className="rounded-lg border border-slate-200"><Table><TableHeader><TableRow><TableHead>Event</TableHead><TableHead>When</TableHead><TableHead>Mentor</TableHead><TableHead>Students</TableHead><TableHead>Subject</TableHead></TableRow></TableHeader><TableBody>{detail.events.map((event) => <TableRow key={event.externalId}><TableCell><p>{event.title || 'Untitled'}</p><p className="font-mono text-xs text-slate-500">{event.externalId}</p></TableCell><TableCell>{new Date(event.startTime).toLocaleString()}</TableCell><TableCell>{event.mentor || 'Unmapped'}</TableCell><TableCell>{event.studentIds.length}</TableCell><TableCell>{event.subjectName || 'Not configured'}</TableCell></TableRow>)}</TableBody></Table></div></div>}
    </Modal>
  </div></AppShell>;
}
