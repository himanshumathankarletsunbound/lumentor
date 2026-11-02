'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { formatCurrency } from '../../../lib/utils/formatters';
import { CheckCircle2, Download, MessageSquare, Send, Upload, XCircle } from 'lucide-react';

type Line = {
  id: string; mentorId: string; mentorName: string; mentorEmail: string; grossEarnings: number; totalAmount: number; deductions: number; netPayable: number;
  reviewStatus: string; reviewerRemark?: string | null;
  breakdown: Array<{ code: string; name: string; category: string; count: number; rate: number; amount: number }>;
};
type Batch = { id: string; batchNumber: string; periodName: string; sourceFileName: string; status: string; totalMentors: number; totalGross: number; totalNet: number; lineItems: Line[] };

export default function SheetPayrollPage() {
  const [month, setMonth] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [remark, setRemark] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const active = batches.find((batch) => batch.id === selectedId) || batches[0];

  const load = useCallback(async () => {
    const response = await fetch('/api/payroll/sheet');
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load sheet payroll batches.');
    setBatches(payload.batches);
    setSelectedId((current) => current || payload.batches[0]?.id || '');
  }, []);
  useEffect(() => {
    const currentMonthTimer = window.setTimeout(() => setMonth(new Date().toISOString().slice(0, 7)), 0);
    const timer = window.setTimeout(() => {
      void load().catch((error: unknown) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load batches.' }));
    }, 0);
    return () => {
      window.clearTimeout(currentMonthTimer);
      window.clearTimeout(timer);
    };
  }, [load]);

  const downloadTemplate = async () => {
    const response = await fetch('/api/payroll/sheet/template');
    if (!response.ok) { setNotice({ type: 'error', message: 'Unable to download template.' }); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'sheet-payroll-template.xlsx'; link.click(); URL.revokeObjectURL(url);
  };

  const upload = async () => {
    if (!file) return;
    setNotice(null);
    const form = new FormData(); form.append('file', file); form.append('month', month);
    const response = await fetch('/api/payroll/sheet', { method: 'POST', body: form });
    const payload = await response.json();
    if (!response.ok || !payload.success) { setNotice({ type: 'error', message: payload.error || 'Upload failed.' }); return; }
    setNotice({ type: 'success', message: 'Sheet calculated successfully. Review every mentor before submitting.' });
    await load(); setSelectedId(payload.batch.id); setFile(null);
  };

  const action = async (body: Record<string, string>) => {
    const response = await fetch('/api/payroll/sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Sheet payroll action failed.');
    await load();
    setNotice({ type: 'success', message: 'Sheet payroll updated.' });
  };

  const reviewLine = async (line: Line, status: 'APPROVED' | 'CHANGES_REQUESTED') => {
    try { await action({ action: 'REVIEW_LINE', batchId: active.id, lineItemId: line.id, reviewStatus: status, remark: remark[line.id] || '' }); }
    catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to review line.' }); }
  };

  return <AppShell>
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Finance & Payroll</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sheet-Based Payroll</h1>
        <p className="text-sm text-slate-500">Temporary, reviewable payroll for months where Classcard attendance is unavailable. This calculation is separate from Process Payroll Batch.</p>
      </div>
      {notice && <Alert variant={notice.type === 'error' ? 'error' : 'success'}>{notice.message}</Alert>}
      <Card>
        <CardHeader title="Upload monthly count sheet" subtitle="Download the final Excel template first. It contains mentor ID plus payroll-plan, initiative, and penalty-policy IDs." />
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <label className="text-xs font-semibold text-slate-700">Payroll month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="flex-1 text-xs font-semibold text-slate-700">Excel count sheet<input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => void downloadTemplate()}>Download template</Button>
            <Button variant="primary" leftIcon={<Upload className="h-4 w-4" />} disabled={!file} onClick={() => void upload()}>Upload & calculate</Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Calculation: (payroll plans + initiatives - penalties), rounded, then 10% TDS is deducted from that total. Rates, payout factors, and penalty amounts come from the database.</p>
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Card><CardHeader title="Calculated batches" /><CardContent><div className="space-y-2">{batches.length === 0 && <p className="text-sm text-slate-500">No sheet payroll batches yet.</p>}{batches.map((batch) => <button key={batch.id} onClick={() => setSelectedId(batch.id)} className={`w-full rounded-lg border p-3 text-left ${active?.id === batch.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'}`}><p className="font-semibold text-slate-800">{batch.periodName}</p><p className="mt-1 text-xs text-slate-500">{batch.totalMentors} mentors · {formatCurrency(batch.totalNet, 'INR')}</p><Badge size="sm" variant={batch.status === 'LOCKED' ? 'success' : 'warning'}>{batch.status}</Badge></button>)}</div></CardContent></Card>
        {active && <Card><CardHeader title={`${active.periodName} · Mentor review`} subtitle={`${active.sourceFileName} · ${active.batchNumber}`} /><CardContent><div className="space-y-4">{active.lineItems.map((line) => <div key={line.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="font-bold text-slate-900">{line.mentorName}</p><p className="text-xs text-slate-500">{line.mentorEmail}</p></div><div className="text-right"><p className="text-lg font-bold text-indigo-700">{formatCurrency(line.netPayable, 'INR')}</p><p className="text-xs text-slate-600">Plans + initiatives {formatCurrency(line.grossEarnings, 'INR')} · After penalties {formatCurrency(line.totalAmount, 'INR')} · Total deductions {formatCurrency(line.deductions, 'INR')}</p><Badge size="sm" variant={line.reviewStatus === 'APPROVED' ? 'success' : line.reviewStatus === 'CHANGES_REQUESTED' ? 'danger' : 'warning'}>{line.reviewStatus}</Badge></div></div><div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left text-slate-500"><th className="py-2">Component</th><th className="py-2">Count</th><th className="py-2 text-right">Rate</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{line.breakdown.map((item) => <tr key={item.code} className="border-b border-slate-100"><td className="py-2">{item.name} <span className="text-slate-400">({item.code})</span></td><td className="py-2">{item.count}</td><td className="py-2 text-right">{formatCurrency(item.rate, 'INR')}</td><td className="py-2 text-right font-semibold">{item.category === 'PENALTY' ? '-' : ''}{formatCurrency(item.amount, 'INR')}</td></tr>)}</tbody></table></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={remark[line.id] ?? line.reviewerRemark ?? ''} onChange={(event) => setRemark((current) => ({ ...current, [line.id]: event.target.value }))} placeholder="Mentor-specific review remark" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" /></div><Button variant="outline" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => void reviewLine(line, 'CHANGES_REQUESTED')}>Send back</Button><Button variant="primary" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => void reviewLine(line, 'APPROVED')}>Approve line</Button></div></div>)}</div><div className="mt-5 flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" leftIcon={<Send className="h-4 w-4" />} disabled={active.status !== 'DRAFT' && active.status !== 'CHANGES_REQUESTED'} onClick={() => void action({ action: 'SUBMIT', batchId: active.id })}>Submit for approval</Button><Button variant="primary" disabled={active.status !== 'SUBMITTED'} onClick={() => void action({ action: 'APPROVE', batchId: active.id })}>Approve & publish payroll</Button></div></CardContent></Card>}
      </div>
    </div>
  </AppShell>;
}
