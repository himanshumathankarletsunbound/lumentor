'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Alert } from '../../../components/ui/Alert';
import { formatCurrency } from '../../../lib/utils/formatters';
import type { InitiativeEntry, InitiativePlan } from '../../../lib/types/payroll';
import type { Mentor } from '../../../lib/types/models';
import { Calculator, ListChecks, Plus, Sparkles } from 'lucide-react';

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Initiatives & Fixed Payouts</h1>
            <p className="text-xs text-slate-500 mt-0.5">Configure reusable payout plans and period-specific mentor awards.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Amount × count × factor</span>
          </div>
        </div>
        {notice && <Alert variant={notice.type === 'error' ? 'error' : 'success'}>{notice.message}</Alert>}
        <div className="flex items-center gap-1 border-b border-slate-200">
          <button type="button" onClick={() => setTab('plans')} className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${tab === 'plans' ? 'text-indigo-700 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800'}`}>
            Plans
          </button>
          <button type="button" onClick={() => setTab('single')} className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${tab === 'single' ? 'text-indigo-700 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800'}`}>
            Single Initiative
          </button>
        </div>
        {tab === 'plans' ? (
          <div className="grid lg:grid-cols-[340px_1fr] gap-5">
            <Card>
              <CardHeader title="Create payout plan" subtitle="Reusable fixed amount and factor." />
              <CardContent className="space-y-4">
                <div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Plan Name *</label><input value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} placeholder="Perfect Attendance" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Plan Code *</label><input value={planForm.code} onChange={(event) => setPlanForm({ ...planForm, code: event.target.value.toUpperCase() })} placeholder="ATTENDANCE-01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Plan Type *</label><select value={planForm.planType} onChange={(event) => setPlanForm({ ...planForm, planType: event.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"><option value="INITIATIVE">Initiative</option><option value="FIXED_PAYOUT">Fixed Payout</option></select></div>
                <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Amount</label><input value={planForm.amount} onChange={(event) => setPlanForm({ ...planForm, amount: event.target.value })} placeholder="500" type="number" min="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none" /></div><div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Payout Factor</label><input value={planForm.payoutFactor} onChange={(event) => setPlanForm({ ...planForm, payoutFactor: event.target.value })} placeholder="1.00" type="number" min="0" step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none" /></div></div>
                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => void savePlan().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save plan.' }))}>Save Plan</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Active plans" subtitle={`${plans.length} reusable payout plan${plans.length === 1 ? '' : 's'}`} action={<ListChecks className="w-5 h-5 text-indigo-500" />} />
              <CardContent className="p-0">
                {plans.length === 0 ? <div className="py-14 text-center text-xs text-slate-400">No initiative or fixed payout plans configured.</div> : <div className="divide-y divide-slate-100">{plans.map((plan) => <div key={plan.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Sparkles className="w-4 h-4" /></div><div><div className="font-semibold text-sm text-slate-900">{plan.name}</div><div className="text-[11px] text-slate-500 font-mono mt-0.5">{plan.code} <span className="font-sans text-slate-300">•</span> {plan.planType.replace('_', ' ')}</div></div></div><div className="text-right"><div className="font-semibold text-sm text-slate-900">{formatCurrency(plan.amount)}</div><div className="text-[11px] text-slate-500">× factor {plan.payoutFactor}</div></div></div>)}</div>}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader title="Add single initiative" subtitle="Assign an initiative to one mentor for a payroll period." />
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4"><div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Mentor *</label><select value={entryForm.mentorId} onChange={(event) => setEntryForm({ ...entryForm, mentorId: event.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"><option value="">Select mentor</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.firstName} {mentor.lastName}</option>)}</select></div><div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Plan</label><select value={entryForm.planId} onChange={(event) => { const plan = plans.find((item) => item.id === event.target.value); setEntryForm({ ...entryForm, planId: event.target.value, name: plan?.name || '', amount: plan ? String(plan.amount) : '', payoutFactor: plan ? String(plan.payoutFactor) : '1' }); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"><option value="">Custom initiative</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></div><div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Initiative Name *</label><input value={entryForm.name} onChange={(event) => setEntryForm({ ...entryForm, name: event.target.value })} placeholder="e.g. Trial conversion bonus" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none" /></div></div>
                <div className="grid md:grid-cols-4 gap-4"><div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Payroll Month</label><input value={month} onChange={(event) => setMonth(event.target.value)} type="month" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none" /></div><div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Amount</label><input value={entryForm.amount} onChange={(event) => setEntryForm({ ...entryForm, amount: event.target.value })} placeholder="500" type="number" min="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none" /></div><div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Count</label><input value={entryForm.count} onChange={(event) => setEntryForm({ ...entryForm, count: event.target.value })} placeholder="1" type="number" min="1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none" /></div><div><label className="text-[11px] font-semibold text-slate-700 block mb-1">Payout Factor</label><input value={entryForm.payoutFactor} onChange={(event) => setEntryForm({ ...entryForm, payoutFactor: event.target.value })} placeholder="1.00" type="number" min="0" step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none" /></div></div>
                <div className="flex items-center justify-between pt-2"><p className="text-[11px] text-slate-500">Calculated total: <strong className="text-slate-800">{formatCurrency(Number(entryForm.amount || 0) * Number(entryForm.count || 0) * Number(entryForm.payoutFactor || 0))}</strong></p><Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => void saveEntry().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save initiative.' }))}>Add Initiative</Button></div>
              </CardContent>
            </Card>
            <Card><CardHeader title="Period initiatives" subtitle={month ? `Unapplied entries for ${month}` : 'Select a payroll month'} action={<Calculator className="w-5 h-5 text-indigo-500" />} /><CardContent className="p-0">{entries.length === 0 ? <div className="py-14 text-center text-xs text-slate-400">No initiatives have been added for this period.</div> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Mentor</th><th className="px-6 py-3">Initiative</th><th className="px-6 py-3">Calculation</th><th className="px-6 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{entries.map((entry) => <tr key={entry.id} className="hover:bg-slate-50/70"><td className="px-6 py-3 font-semibold text-slate-800">{entry.mentorName}</td><td className="px-6 py-3"><div className="font-medium text-slate-800">{entry.name}</div><div className="text-[10px] text-slate-400">{entry.planName || 'Custom initiative'}</div></td><td className="px-6 py-3 text-slate-500">{entry.count} × {formatCurrency(entry.amount)} × {entry.payoutFactor}</td><td className="px-6 py-3 text-right font-semibold text-slate-900">{formatCurrency(entry.totalAmount)}</td></tr>)}</tbody></table></div>}</CardContent></Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
