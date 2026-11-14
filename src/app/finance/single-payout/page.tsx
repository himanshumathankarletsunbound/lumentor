'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table';
import { formatCurrency, formatDateTime } from '../../../lib/utils/formatters';
import { ClassEvent, Mentor, Branch, Subject } from '../../../lib/types/models';
import { InitiativeEntry, InitiativePlan, Penalty, PenaltyPolicy, PayrollBatch, PayrollPlan } from '../../../lib/types/payroll';
import { Plus, RefreshCw } from 'lucide-react';

function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    startDate: new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString(),
    endDate: new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999)).toISOString(),
  };
}

function attendanceBadges(classEvent: ClassEvent) {
  const counts = new Map<string, number>();
  for (const student of classEvent.students) {
    const label = student.attendanceStatus === 'ABSENT_BILLABLE'
      ? 'Absent billable'
      : student.attendanceStatus === 'UNMARKED'
        ? 'Unmarked'
        : student.attendanceStatus === 'LATE'
          ? 'Present'
          : student.attendanceStatus.charAt(0) + student.attendanceStatus.slice(1).toLowerCase();
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  if (counts.size === 0) counts.set('Unmarked', 1);
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

function hasBillableAbsence(classEvent: ClassEvent) {
  return classEvent.students.some((student) => student.attendanceStatus === 'ABSENT_BILLABLE');
}

export default function SinglePayoutPage() {
  const [month, setMonth] = useState('2000-01');
  const [mentorId, setMentorId] = useState('');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentorSearch, setMentorSearch] = useState('');
  const [mentorMenuOpen, setMentorMenuOpen] = useState(false);
  const mentorsInitialized = useRef(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassEvent[]>([]);
  const [batch, setBatch] = useState<PayrollBatch | null>(null);
  const [plans, setPlans] = useState<PayrollPlan[]>([]);
  const [classPayrollPlanOverrides, setClassPayrollPlanOverrides] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [addingClass, setAddingClass] = useState(false);
  const [classForm, setClassForm] = useState({ title: '', subjectId: '', branchId: '', startTime: `${month}-01T10:00`, durationMinutes: '60' });
  const [incentiveOpen, setIncentiveOpen] = useState(false);
  const [incentivePlanId, setIncentivePlanId] = useState('');
  const [incentiveReason, setIncentiveReason] = useState('');
  const [incentiveAmount, setIncentiveAmount] = useState('');
  const [initiativePlans, setInitiativePlans] = useState<InitiativePlan[]>([]);
  const [incentives, setIncentives] = useState<InitiativeEntry[]>([]);
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [penaltyPolicyId, setPenaltyPolicyId] = useState('');
  const [penaltyReason, setPenaltyReason] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyPolicies, setPenaltyPolicies] = useState<PenaltyPolicy[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);

  const bounds = useMemo(() => monthBounds(month), [month]);
  const filteredMentors = useMemo(() => {
    const query = mentorSearch.trim().toLowerCase();
    if (!query) return mentors;
    return mentors.filter((mentor) =>
      `${mentor.firstName} ${mentor.lastName}`.toLowerCase().includes(query) ||
      mentor.email.toLowerCase().includes(query) ||
      mentor.phone.toLowerCase().includes(query)
    );
  }, [mentorSearch, mentors]);

  const loadMentors = useCallback(async () => {
    const response = await fetch('/api/mentors');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load mentors.');
    setMentors(result.mentors);
    if (!mentorsInitialized.current && result.mentors[0]) {
      mentorsInitialized.current = true;
      setMentorId(result.mentors[0].id);
      setMentorSearch(`${result.mentors[0].firstName} ${result.mentors[0].lastName}`);
    }
  }, []);

  const loadReferenceData = useCallback(async () => {
    const dashboardResponse = await fetch('/api/dashboard');
    const dashboard = await dashboardResponse.json();
    if (!dashboardResponse.ok || !dashboard.success) throw new Error(dashboard.error || 'Unable to load payroll data.');
    setBranches(dashboard.data.branches);
    const subjectsResponse = await fetch('/api/records?type=subject');
    const subjectsResult = await subjectsResponse.json();
    if (subjectsResponse.ok && subjectsResult.success) setSubjects(subjectsResult.records);
    const plansResponse = await fetch('/api/payroll/plans');
    const plansResult = await plansResponse.json();
    if (!plansResponse.ok || !plansResult.success) throw new Error(plansResult.error || 'Unable to load payroll plans.');
    setPlans(plansResult.plans);
  }, []);

  const loadClasses = useCallback(async () => {
    if (!mentorId) return;
    const response = await fetch(`/api/classes?mentorId=${encodeURIComponent(mentorId)}&startDate=${encodeURIComponent(bounds.startDate)}&endDate=${encodeURIComponent(bounds.endDate)}`);
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load classes.');
    setClasses(result.classes);
  }, [mentorId, bounds.startDate, bounds.endDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = new Date();
      setMonth(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadMentors(), loadReferenceData()]).catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load payout data.' }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMentors, loadReferenceData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClasses().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load classes.' }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadClasses]);

  const loadAdjustments = useCallback(async () => {
    if (!mentorId) {
      setIncentives([]);
      setPenalties([]);
      return;
    }
    const [initiativePlansResponse, initiativesResponse, policiesResponse, penaltiesResponse] = await Promise.all([
      fetch('/api/payroll/initiatives/plans'),
      fetch(`/api/payroll/initiatives?startDate=${encodeURIComponent(bounds.startDate)}&endDate=${encodeURIComponent(bounds.endDate)}&mentorId=${encodeURIComponent(mentorId)}`),
      fetch('/api/penalty-policies'),
      fetch(`/api/penalties?mentorId=${encodeURIComponent(mentorId)}`),
    ]);
    const [initiativePlansResult, initiativesResult, policiesResult, penaltiesResult] = await Promise.all([
      initiativePlansResponse.json(), initiativesResponse.json(), policiesResponse.json(), penaltiesResponse.json(),
    ]);
    if (!initiativePlansResponse.ok || !initiativePlansResult.success) throw new Error(initiativePlansResult.error || 'Unable to load incentive plans.');
    if (!initiativesResponse.ok || !initiativesResult.success) throw new Error(initiativesResult.error || 'Unable to load incentives.');
    if (!policiesResponse.ok || !policiesResult.success) throw new Error(policiesResult.error || 'Unable to load penalty policies.');
    if (!penaltiesResponse.ok) throw new Error(penaltiesResult.error || 'Unable to load penalties.');
    setInitiativePlans(initiativePlansResult.plans.filter((plan: InitiativePlan) => plan.isActive !== false));
    setIncentives(initiativesResult.entries);
    setPenaltyPolicies(policiesResult.policies.filter((policy: PenaltyPolicy) => policy.isActive !== false));
    setPenalties(penaltiesResult);
  }, [bounds.endDate, bounds.startDate, mentorId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAdjustments().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load payout adjustments.' }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAdjustments]);

  const addClass = async () => {
    const response = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...classForm, mentorId, durationMinutes: Number(classForm.durationMinutes), studentIds: [] }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to add class.');
    setAddingClass(false);
    await loadClasses();
    setNotice({ type: 'success', message: 'Class added to this payout period.' });
  };

  const calculate = async () => {
    if (!mentorId) throw new Error('Select a mentor before calculating.');
    const response = await fetch('/api/payroll/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId: `single-${month}`, ...bounds, mentorIds: [mentorId], classPayrollPlanOverrides }),
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || 'Unable to calculate payout. Configure an active payroll plan first.');
    setBatch(result);
    setNotice({ type: 'success', message: `${result.batchNumber} is ready. Submit it for administrator approval.` });
  };

  const approve = async () => {
    if (!batch) return;
    const response = await fetch('/api/payroll/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId: batch.id, approverId: 'current-admin', approverName: 'Administrator', action: 'APPROVE' }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to approve payout.');
    setBatch(result);
    setNotice({ type: 'success', message: 'Payout approved. Lock it to generate the official mentor payslip.' });
  };

  const lock = async () => {
    if (!batch) return;
    const response = await fetch('/api/payroll/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId: batch.id, lockedBy: 'Administrator' }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to finalize payout.');
    setBatch({ ...batch, status: 'LOCKED' });
    setNotice({ type: 'success', message: 'Payout finalized and the official payslip is now available to the mentor.' });
  };

  const addIncentive = async () => {
    const selectedPlan = initiativePlans.find((plan) => plan.id === incentivePlanId);
    const amount = selectedPlan ? selectedPlan.amount : Number(incentiveAmount);
    const name = selectedPlan ? selectedPlan.name : incentiveReason.trim();
    if (!name || !Number.isFinite(amount) || amount <= 0) throw new Error('Select an incentive type or enter a custom name and positive amount.');
    const response = await fetch('/api/payroll/initiatives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId, planId: selectedPlan?.id, name, amount, count: 1, payoutFactor: selectedPlan?.payoutFactor || 1, periodStart: bounds.startDate, periodEnd: bounds.endDate }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to add incentive.');
    setIncentiveOpen(false);
    setIncentivePlanId('');
    setIncentiveReason('');
    setIncentiveAmount('');
    setBatch(null);
    await loadAdjustments();
    setNotice({ type: 'success', message: 'Incentive added. Calculate the payout to include it.' });
  };

  const selectIncentiveType = (id: string) => {
    const selectedPlan = initiativePlans.find((plan) => plan.id === id);
    setIncentivePlanId(id);
    setIncentiveReason(selectedPlan ? selectedPlan.name : '');
    setIncentiveAmount(selectedPlan ? String(selectedPlan.amount) : '');
  };

  const selectPenaltyType = (id: string) => {
    const policy = penaltyPolicies.find((item) => item.id === id);
    setPenaltyPolicyId(id);
    setPenaltyReason(policy ? policy.name : '');
    setPenaltyAmount(policy ? String(policy.defaultAmount || policy.rateValue || '') : '');
  };

  const addPenalty = async () => {
    const mentor = mentors.find((item) => item.id === mentorId);
    const policy = penaltyPolicies.find((item) => item.id === penaltyPolicyId);
    const amount = Number(penaltyAmount);
    const reason = penaltyReason.trim();
    if (!mentor?.branchId) throw new Error('The selected mentor must have a branch before a penalty can be added.');
    if (!reason || !Number.isFinite(amount) || amount <= 0) throw new Error('Select a penalty type or enter a custom name and positive amount.');
    const response = await fetch('/api/penalties', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId, branchId: mentor.branchId, category: policy?.name || 'OTHER', reason, amount, approveImmediately: true }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to add penalty.');
    setPenaltyOpen(false);
    setPenaltyPolicyId('');
    setPenaltyReason('');
    setPenaltyAmount('');
    setBatch(null);
    await loadAdjustments();
    setNotice({ type: 'success', message: 'Approved penalty added. Calculate the payout to include it.' });
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Single Payout</h1>
          <p className="text-xs text-slate-500 mt-1">Review one mentor’s monthly classes, incentives, deductions, approval, and payslip.</p>
        </div>
        {notice && <Alert type={notice.type} title={notice.type === 'success' ? 'Success' : 'Error'} message={notice.message} />}
        <Card>
          <CardHeader title="1. Select mentor and month" />
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="relative">
              <label htmlFor="mentor-search" className="font-semibold text-slate-700">Mentor</label>
              <input
                id="mentor-search"
                type="search"
                value={mentorSearch}
                onChange={(event) => {
                  setMentorSearch(event.target.value);
                  setMentorMenuOpen(true);
                  setMentorId('');
                  setBatch(null);
                }}
                onFocus={() => {
                  setMentorSearch('');
                  setMentorMenuOpen(true);
                }}
                onBlur={() => window.setTimeout(() => setMentorMenuOpen(false), 150)}
                placeholder="Search mentor by name, email, or phone"
                autoComplete="off"
                className="mt-1 w-full p-2 border rounded-lg font-normal"
              />
              {mentorMenuOpen && (
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {filteredMentors.length > 0 ? filteredMentors.map((mentor) => (
                    <button
                      key={mentor.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setMentorId(mentor.id);
                        setMentorSearch(`${mentor.firstName} ${mentor.lastName}`);
                        setMentorMenuOpen(false);
                        setBatch(null);
                      }}
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-indigo-50"
                    >
                      <span className="font-semibold text-slate-800">{mentor.firstName} {mentor.lastName}</span>
                      <span className="block text-[11px] text-slate-500">{mentor.email || mentor.phone || 'No contact details'}</span>
                    </button>
                  )) : (
                    <p className="px-3 py-2 text-xs text-slate-500">No mentors found.</p>
                  )}
                </div>
              )}
            </div>
            <label className="font-semibold text-slate-700">Month<input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setBatch(null); }} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
            <div className="flex items-end"><Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => void loadClasses()}>Refresh classes</Button></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="2. Classes in this payout period" subtitle={classes.length ? 'Present sessions use their Title Mapper plan. Choose a plan only for billable absences.' : 'No classes found; administrators can add one below.'} />
          <CardContent>
            <Table><TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Subject</TableHead><TableHead>Date</TableHead><TableHead>Attendance</TableHead><TableHead>Payroll plan</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{classes.map((item) => {
              const billableAbsence = hasBillableAbsence(item);
              return <TableRow key={item.id}><TableCell className="font-semibold">{item.title}</TableCell><TableCell>{item.subjectName}</TableCell><TableCell>{formatDateTime(item.startTime)}</TableCell><TableCell><div className="flex flex-wrap gap-1">{attendanceBadges(item).map(({ label, count }) => <Badge key={label} variant={label === 'Present' ? 'success' : label === 'Absent billable' ? 'warning' : 'neutral'} size="sm">{label} · {count}</Badge>)}</div></TableCell><TableCell>{billableAbsence ? <select value={classPayrollPlanOverrides[item.id] || ''} onChange={(event) => { setClassPayrollPlanOverrides((current) => ({ ...current, [item.id]: event.target.value })); setBatch(null); }} className="w-44 rounded-lg border p-2 text-xs"><option value="">Select billable plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} (v{plan.version})</option>)}</select> : item.mappedPayrollPlanName ? <span className="text-xs font-medium text-emerald-700">{item.mappedPayrollPlanName}</span> : <span className="text-xs text-slate-500">{item.attendanceStatusSummary === 'UNMARKED' || item.attendanceStatusSummary === 'ALL_ABSENT' ? 'Not payable' : 'Not mapped'}</span>}</TableCell><TableCell><Badge variant="neutral" size="sm">{item.status}</Badge></TableCell></TableRow>;
            })}</TableBody></Table>
            <Button variant="outline" size="sm" className="mt-3" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setAddingClass(true)}>Add class</Button>
          </CardContent>
        </Card>
        {addingClass && <Card><CardHeader title="Add class to payout" /><CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"><input placeholder="Class title" value={classForm.title} onChange={(e) => setClassForm({ ...classForm, title: e.target.value })} className="p-2 border rounded-lg" /><select value={classForm.subjectId} onChange={(e) => setClassForm({ ...classForm, subjectId: e.target.value })} className="p-2 border rounded-lg"><option value="">Select subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><select value={classForm.branchId} onChange={(e) => setClassForm({ ...classForm, branchId: e.target.value })} className="p-2 border rounded-lg"><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><input type="datetime-local" value={classForm.startTime} onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })} className="p-2 border rounded-lg" /><input type="number" min="1" value={classForm.durationMinutes} onChange={(e) => setClassForm({ ...classForm, durationMinutes: e.target.value })} className="p-2 border rounded-lg" /><div className="flex gap-2"><Button size="sm" variant="primary" onClick={() => void addClass().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to add class.' }))}>Save class</Button><Button size="sm" variant="ghost" onClick={() => setAddingClass(false)}>Cancel</Button></div></CardContent></Card>}
        <Card><CardHeader title="3. Incentives, penalties, and approval" subtitle="Select a configured type or add a custom adjustment. Added entries appear below and are included on the next calculation." /><CardContent className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!mentorId} onClick={() => { setIncentiveOpen(true); setPenaltyOpen(false); }}>Add incentive</Button><Button variant="outline" size="sm" disabled={!mentorId} onClick={() => { setPenaltyOpen(true); setIncentiveOpen(false); }}>Add penalty</Button><Button variant="primary" size="sm" disabled={!mentorId} onClick={() => void calculate().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to calculate payout.' }))}>Calculate payout</Button>{batch && <><span className="px-3 py-2 rounded-lg bg-slate-100">Status: <strong>{batch.status}</strong> · Net: <strong>{formatCurrency(batch.totalNet)}</strong></span>{batch.status === 'DRAFT' && <Button size="sm" variant="outline" onClick={() => void (async () => { const response = await fetch('/api/payroll/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId: batch.id, approverId: 'current-admin', approverName: 'Payroll preparer', action: 'SUBMIT' }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to submit payout.'); setBatch(result); setNotice({ type: 'success', message: 'Payout submitted for administrator approval.' }); })().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to submit payout.' }))}>Submit for approval</Button>}{batch.status === 'SUBMITTED' && <Button size="sm" variant="success" onClick={() => void approve().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to approve payout.' }))}>Approve payout</Button>}{batch.status === 'APPROVED' && <Button size="sm" variant="success" onClick={() => void lock().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to finalize payout.' }))}>Finalize & generate payslip</Button>}</>}</div>

          {incentiveOpen && <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"><p className="mb-3 font-semibold text-emerald-900">Add incentive</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-4"><select value={incentivePlanId} onChange={(event) => selectIncentiveType(event.target.value)} className="rounded-lg border p-2"><option value="">Custom incentive</option>{initiativePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatCurrency(plan.amount)}</option>)}</select><input value={incentiveReason} disabled={Boolean(incentivePlanId)} onChange={(event) => setIncentiveReason(event.target.value)} placeholder="Custom incentive name" className="rounded-lg border p-2 disabled:bg-slate-100" /><input value={incentiveAmount} disabled={Boolean(incentivePlanId)} onChange={(event) => setIncentiveAmount(event.target.value)} type="number" min="0" step="0.01" placeholder="Amount" className="rounded-lg border p-2 disabled:bg-slate-100" /><Button size="sm" variant="success" onClick={() => void addIncentive().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to add incentive.' }))}>Add incentive</Button></div></div>}
          {penaltyOpen && <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4"><p className="mb-1 font-semibold text-rose-900">Add approved penalty</p><p className="mb-3 text-slate-600">This deduction is approved by the payroll administrator and will be included when the payout is calculated.</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-4"><select value={penaltyPolicyId} onChange={(event) => selectPenaltyType(event.target.value)} className="rounded-lg border p-2"><option value="">Custom penalty</option>{penaltyPolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name} · {formatCurrency(policy.defaultAmount || policy.rateValue || 0)}</option>)}</select><input value={penaltyReason} disabled={Boolean(penaltyPolicyId)} onChange={(event) => setPenaltyReason(event.target.value)} placeholder="Custom penalty name" className="rounded-lg border p-2 disabled:bg-slate-100" /><input value={penaltyAmount} onChange={(event) => setPenaltyAmount(event.target.value)} type="number" min="0" step="0.01" placeholder="Amount" className="rounded-lg border p-2" /><Button size="sm" variant="danger" onClick={() => void addPenalty().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to add penalty.' }))}>Add penalty</Button></div></div>}

          <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-emerald-100"><div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-3 py-2"><span className="font-semibold text-emerald-900">Added incentives</span><span className="font-bold text-emerald-800">+{formatCurrency(incentives.reduce((sum, item) => sum + item.totalAmount, 0))}</span></div><div className="divide-y divide-slate-100">{incentives.length ? incentives.map((item) => <div key={item.id} className="flex items-center justify-between px-3 py-2"><span>{item.name}<span className="ml-1 text-slate-400">{item.planName ? '· configured' : '· custom'}</span></span><span className="font-semibold text-emerald-700">+{formatCurrency(item.totalAmount)}</span></div>) : <p className="px-3 py-5 text-slate-500">No incentives added for this payout period.</p>}</div></div><div className="rounded-xl border border-rose-100"><div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-3 py-2"><span className="font-semibold text-rose-900">Approved penalties</span><span className="font-bold text-rose-800">-{formatCurrency(penalties.filter((item) => item.status === 'APPROVED').reduce((sum, item) => sum + item.amount, 0))}</span></div><div className="divide-y divide-slate-100">{penalties.filter((item) => item.status === 'APPROVED').length ? penalties.filter((item) => item.status === 'APPROVED').map((item) => <div key={item.id} className="flex items-center justify-between px-3 py-2"><span>{item.reason}<span className="ml-1 text-slate-400">· {item.category}</span></span><span className="font-semibold text-rose-700">-{formatCurrency(item.amount)}</span></div>) : <p className="px-3 py-5 text-slate-500">No approved penalties for this mentor.</p>}</div></div></div>
        </CardContent></Card>
      </div>
    </AppShell>
  );
}
