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
import { PayrollBatch, PayrollPlan } from '../../../lib/types/payroll';
import { PenaltyModal } from '../../../components/payroll/PenaltyModal';
import { Plus, RefreshCw } from 'lucide-react';

function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    startDate: new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString(),
    endDate: new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999)).toISOString(),
  };
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
  const [planId, setPlanId] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [addingClass, setAddingClass] = useState(false);
  const [classForm, setClassForm] = useState({ title: '', subjectId: '', branchId: '', startTime: `${month}-01T10:00`, durationMinutes: '60' });
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [incentiveOpen, setIncentiveOpen] = useState(false);
  const [incentiveReason, setIncentiveReason] = useState('');
  const [incentiveAmount, setIncentiveAmount] = useState('');

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const selectedMentor = mentors.find((mentor) => mentor.id === mentorId);
      if (selectedMentor) setPlanId(selectedMentor.payrollPlanId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mentorId, mentors]);

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
    if (!mentorId || !planId) throw new Error('Select a mentor with an active payout plan before calculating.');
    const response = await fetch('/api/payroll/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId: `single-${month}`, ...bounds, mentorIds: [mentorId], payrollPlanId: planId }),
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
    const response = await fetch('/api/payroll/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId, type: 'BONUS', reason: incentiveReason, amount: Number(incentiveAmount), approvedBy: 'pending', approvedByName: 'Administrator' }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to add incentive.');
    setIncentiveOpen(false);
    setIncentiveReason('');
    setIncentiveAmount('');
    setNotice({ type: 'success', message: 'Incentive added. Recalculate the payout to include it.' });
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
          <CardHeader title="1. Select mentor, payroll plan, and month" />
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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
            <label className="font-semibold text-slate-700">Payout plan<select value={planId} onChange={(e) => { setPlanId(e.target.value); setBatch(null); }} className="mt-1 w-full p-2 border rounded-lg font-normal">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} (v{plan.version})</option>)}</select></label>
            <div className="flex items-end"><Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => void loadClasses()}>Refresh classes</Button></div>
          </CardContent>
        </Card>
        {plans.find((plan) => plan.id === planId) && (() => {
          const plan = plans.find((item) => item.id === planId)!;
          return <Card><CardHeader title="Selected payout plan details" subtitle="Confirm these rules before calculating the payout." /><CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-700"><div><strong>Compensation</strong><br />{plan.compensationModel.replace(/_/g, ' ')}</div><div><strong>Classes in period</strong><br />{classes.length}</div><div><strong>Class rate</strong><br />{formatCurrency(plan.defaultClassRate)}</div><div><strong>Hourly rate</strong><br />{formatCurrency(plan.hourlyRate)}</div><div><strong>Student rate</strong><br />{formatCurrency(plan.perStudentRate)}</div><div><strong>Minimum duration</strong><br />{plan.minEligibleDurationMinutes} minutes</div><div><strong>Late cancellation</strong><br />{plan.lateCancellationPayPercent}% pay</div><div><strong>Base salary</strong><br />{formatCurrency(plan.baseSalary)}</div></CardContent></Card>;
        })()}
        <Card>
          <CardHeader title="2. Classes in this payout period" subtitle={classes.length ? `${classes.length} class(es) found` : 'No classes found; administrators can add one below.'} />
          <CardContent>
            <Table><TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Subject</TableHead><TableHead>Date</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{classes.map((item) => <TableRow key={item.id}><TableCell className="font-semibold">{item.title}</TableCell><TableCell>{item.subjectName}</TableCell><TableCell>{formatDateTime(item.startTime)}</TableCell><TableCell>{item.durationMinutes} min</TableCell><TableCell><Badge variant="neutral" size="sm">{item.status}</Badge></TableCell></TableRow>)}</TableBody></Table>
            <Button variant="outline" size="sm" className="mt-3" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setAddingClass(true)}>Add class</Button>
          </CardContent>
        </Card>
        {addingClass && <Card><CardHeader title="Add class to payout" /><CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"><input placeholder="Class title" value={classForm.title} onChange={(e) => setClassForm({ ...classForm, title: e.target.value })} className="p-2 border rounded-lg" /><select value={classForm.subjectId} onChange={(e) => setClassForm({ ...classForm, subjectId: e.target.value })} className="p-2 border rounded-lg"><option value="">Select subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><select value={classForm.branchId} onChange={(e) => setClassForm({ ...classForm, branchId: e.target.value })} className="p-2 border rounded-lg"><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><input type="datetime-local" value={classForm.startTime} onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })} className="p-2 border rounded-lg" /><input type="number" min="1" value={classForm.durationMinutes} onChange={(e) => setClassForm({ ...classForm, durationMinutes: e.target.value })} className="p-2 border rounded-lg" /><div className="flex gap-2"><Button size="sm" variant="primary" onClick={() => void addClass().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to add class.' }))}>Save class</Button><Button size="sm" variant="ghost" onClick={() => setAddingClass(false)}>Cancel</Button></div></CardContent></Card>}
        <Card><CardHeader title="3. Incentives, penalties, and approval" /><CardContent className="space-y-3 text-xs"><p className="text-slate-600">Add adjustments for the selected mentor before calculating. Approved penalties and incentives are included in the payout.</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!mentorId} onClick={() => setIncentiveOpen(true)}>Add incentive</Button><Button variant="outline" size="sm" disabled={!mentorId} onClick={() => setPenaltyOpen(true)}>Add penalty</Button><Button variant="primary" size="sm" disabled={!mentorId || !planId} onClick={() => void calculate().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to calculate payout.' }))}>Calculate payout</Button>{batch && <><span className="px-3 py-2 rounded-lg bg-slate-100">Status: <strong>{batch.status}</strong> · Net: <strong>{formatCurrency(batch.totalNet)}</strong></span>{batch.status === 'DRAFT' && <Button size="sm" variant="outline" onClick={() => void (async () => { const response = await fetch('/api/payroll/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId: batch.id, approverId: 'current-admin', approverName: 'Payroll preparer', action: 'SUBMIT' }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to submit payout.'); setBatch(result); setNotice({ type: 'success', message: 'Payout submitted for administrator approval.' }); })().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to submit payout.' }))}>Submit for approval</Button>}{batch.status === 'SUBMITTED' && <Button size="sm" variant="success" onClick={() => void approve().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to approve payout.' }))}>Approve payout</Button>}{batch.status === 'APPROVED' && <Button size="sm" variant="success" onClick={() => void lock().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to finalize payout.' }))}>Finalize & generate payslip</Button>}</>}</div>{incentiveOpen && <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><input value={incentiveReason} onChange={(e) => setIncentiveReason(e.target.value)} placeholder="Incentive reason" className="p-2 border rounded-lg" /><input value={incentiveAmount} onChange={(e) => setIncentiveAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount" className="p-2 border rounded-lg" /><Button size="sm" variant="success" onClick={() => void addIncentive().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to add incentive.' }))}>Save incentive</Button></div>}</CardContent></Card>
        <PenaltyModal initialMentorId={mentorId} isOpen={penaltyOpen} onClose={() => setPenaltyOpen(false)} onSaved={() => setNotice({ type: 'success', message: 'Penalty added. Recalculate the payout to include it.' })} />
      </div>
    </AppShell>
  );
}
