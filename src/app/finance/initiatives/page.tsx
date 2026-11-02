'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Alert } from '../../../components/ui/Alert';
import { formatCurrency } from '../../../lib/utils/formatters';
import type { InitiativeEntry, InitiativePlan } from '../../../lib/types/payroll';
import type { Mentor } from '../../../lib/types/models';

function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    startDate: new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString(),
    endDate: new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999)).toISOString(),
  };
}

type ApiResponse<T extends object = Record<string, never>> = { success?: boolean; error?: string } & T;

async function readJsonResponse<T extends object>(response: Response, fallbackMessage: string): Promise<ApiResponse<T>> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${fallbackMessage} (server returned an empty response, status ${response.status}).`);
  }
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new Error(`${fallbackMessage} (server returned an invalid response, status ${response.status}).`);
  }
}

export default function InitiativesPage() {
  const [tab, setTab] = useState<'plans' | 'single'>('plans');
  const [plans, setPlans] = useState<InitiativePlan[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [entries, setEntries] = useState<InitiativeEntry[]>([]);
  const [month, setMonth] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [planForm, setPlanForm] = useState({ name: '', code: '', planType: 'INITIATIVE', amount: '', payoutFactor: '1' });
  const [entryForm, setEntryForm] = useState({ mentorId: '', planId: '', name: '', amount: '', count: '1', payoutFactor: '1' });
  const bounds = useMemo(() => (month ? monthBounds(month) : null), [month]);

  const load = useCallback(async () => {
    if (!bounds) return;
    const [plansResponse, mentorsResponse, entriesResponse] = await Promise.all([
      fetch('/api/payroll/initiatives/plans'),
      fetch('/api/mentors'),
      fetch(`/api/payroll/initiatives?startDate=${encodeURIComponent(bounds.startDate)}&endDate=${encodeURIComponent(bounds.endDate)}`),
    ]);
    const [plansResult, mentorsResult, entriesResult] = await Promise.all([
      readJsonResponse<{ plans: InitiativePlan[] }>(plansResponse, 'Unable to load initiative plans.'),
      readJsonResponse<{ mentors: Mentor[] }>(mentorsResponse, 'Unable to load mentors.'),
      readJsonResponse<{ entries: InitiativeEntry[] }>(entriesResponse, 'Unable to load initiatives.'),
    ]);
    if (!plansResponse.ok || !plansResult.success) throw new Error(plansResult.error || 'Unable to load initiative plans.');
    if (!mentorsResponse.ok || !mentorsResult.success) throw new Error(mentorsResult.error || 'Unable to load mentors.');
    if (!entriesResponse.ok || !entriesResult.success) throw new Error(entriesResult.error || 'Unable to load initiatives.');
    setPlans(plansResult.plans);
    setMentors(mentorsResult.mentors);
    setEntries(entriesResult.entries);
  }, [bounds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMonth(new Date().toISOString().slice(0, 7)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load initiatives.' }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const savePlan = async () => {
    const response = await fetch('/api/payroll/initiatives/plans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...planForm, amount: Number(planForm.amount), payoutFactor: Number(planForm.payoutFactor) }),
    });
    const result = await readJsonResponse(response, 'Unable to save initiative plan.');
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save plan.');
    setPlanForm({ name: '', code: '', planType: 'INITIATIVE', amount: '', payoutFactor: '1' });
    await load();
    setNotice({ type: 'success', message: 'Initiative plan saved.' });
  };

  const saveEntry = async () => {
    if (!bounds) throw new Error('Select a payroll month before adding an initiative.');
    const selectedPlan = plans.find((plan) => plan.id === entryForm.planId);
    const response = await fetch('/api/payroll/initiatives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mentorId: entryForm.mentorId, planId: entryForm.planId || undefined,
        name: entryForm.name || selectedPlan?.name, amount: Number(entryForm.amount || selectedPlan?.amount),
        count: Number(entryForm.count), payoutFactor: Number(entryForm.payoutFactor || selectedPlan?.payoutFactor || 1),
        periodStart: bounds.startDate, periodEnd: bounds.endDate,
      }),
    });
    const result = await readJsonResponse(response, 'Unable to save initiative.');
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save initiative.');
    setEntryForm({ mentorId: '', planId: '', name: '', amount: '', count: '1', payoutFactor: '1' });
    await load();
    setNotice({ type: 'success', message: 'Initiative added to the selected payroll period.' });
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Initiatives & Fixed Payouts</h1>
          <p className="text-xs text-slate-500 mt-1">Configure reusable plans and add period-specific mentor payouts.</p>
        </div>
        {notice && <Alert variant={notice.type === 'error' ? 'error' : 'success'}>{notice.message}</Alert>}
        <div className="flex gap-2 border-b border-slate-200">
          <Button variant={tab === 'plans' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('plans')}>Plans</Button>
          <Button variant={tab === 'single' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('single')}>Single Initiative</Button>
        </div>
        {tab === 'plans' ? (
          <div className="grid lg:grid-cols-[360px_1fr] gap-5">
            <Card><CardHeader title="Create Plan" /><CardContent className="space-y-3">
              {(['name', 'code', 'amount', 'payoutFactor'] as const).map((field) => (
                <input key={field} value={planForm[field]} onChange={(event) => setPlanForm({ ...planForm, [field]: event.target.value })} placeholder={field === 'payoutFactor' ? 'Payout factor (1)' : field} type={field === 'amount' || field === 'payoutFactor' ? 'number' : 'text'} className="w-full border rounded-lg px-3 py-2 text-sm" />
              ))}
              <select value={planForm.planType} onChange={(event) => setPlanForm({ ...planForm, planType: event.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="INITIATIVE">Initiative</option><option value="FIXED_PAYOUT">Fixed Payout</option>
              </select>
              <Button variant="primary" onClick={() => void savePlan().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save plan.' }))}>Save Plan</Button>
            </CardContent></Card>
            <Card><CardHeader title="Active Plans" /><CardContent><div className="space-y-2">{plans.map((plan) => <div key={plan.id} className="border rounded-lg p-3 flex justify-between"><div><div className="font-semibold">{plan.name}</div><div className="text-xs text-slate-500">{plan.code} · {plan.planType}</div></div><div className="text-sm">{formatCurrency(plan.amount)} × {plan.payoutFactor}</div></div>)}</div></CardContent></Card>
          </div>
        ) : (
          <Card><CardHeader title="Add Single Initiative" /><CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <select value={entryForm.mentorId} onChange={(event) => setEntryForm({ ...entryForm, mentorId: event.target.value })} className="border rounded-lg px-3 py-2 text-sm"><option value="">Select mentor</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.firstName} {mentor.lastName}</option>)}</select>
              <select value={entryForm.planId} onChange={(event) => { const plan = plans.find((item) => item.id === event.target.value); setEntryForm({ ...entryForm, planId: event.target.value, name: plan?.name || '', amount: plan ? String(plan.amount) : '', payoutFactor: plan ? String(plan.payoutFactor) : '1' }); }} className="border rounded-lg px-3 py-2 text-sm"><option value="">Custom initiative</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>
              <input value={entryForm.name} onChange={(event) => setEntryForm({ ...entryForm, name: event.target.value })} placeholder="Initiative name" className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid md:grid-cols-4 gap-3">
              <input value={month} onChange={(event) => setMonth(event.target.value)} type="month" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={entryForm.amount} onChange={(event) => setEntryForm({ ...entryForm, amount: event.target.value })} placeholder="Amount" type="number" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={entryForm.count} onChange={(event) => setEntryForm({ ...entryForm, count: event.target.value })} placeholder="Count" type="number" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={entryForm.payoutFactor} onChange={(event) => setEntryForm({ ...entryForm, payoutFactor: event.target.value })} placeholder="Payout factor" type="number" step="0.01" className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <Button variant="primary" onClick={() => void saveEntry().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save initiative.' }))}>Add Initiative</Button>
            <div className="border-t pt-4 space-y-2">{entries.map((entry) => <div key={entry.id} className="flex justify-between text-sm border rounded-lg p-3"><span>{entry.mentorName} · {entry.name} ({entry.count} × {formatCurrency(entry.amount)} × {entry.payoutFactor})</span><strong>{formatCurrency(entry.totalAmount)}</strong></div>)}</div>
          </CardContent></Card>
        )}
      </div>
    </AppShell>
  );
}
