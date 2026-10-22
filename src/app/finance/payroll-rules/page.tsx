'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { PayrollPlan, CompensationModel } from '../../../lib/types/payroll';
import {
  Sliders,
  Plus,
  CheckCircle2,
  History,
  Calculator,
  Edit3,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Code2,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils/formatters';

interface FormulaToken {
  label: string;
  token: string;
  desc: string;
}

const FORMULA_TOKENS: FormulaToken[] = [
  { label: 'Base Salary', token: '[Base Salary]', desc: 'Fixed monthly or prorated cycle base' },
  { label: 'Classes Count', token: '[Classes Count]', desc: 'Total eligible sessions completed' },
  { label: 'Class Rate', token: '[Class Rate]', desc: 'Contracted rate per class' },
  { label: 'Teaching Hours', token: '[Teaching Hours]', desc: 'Calculated teaching hours from class duration' },
  { label: 'Hourly Rate', token: '[Hourly Rate]', desc: 'Hourly instructional pay rate' },
  { label: 'Attending Students', token: '[Attending Students]', desc: 'Count of present/checked-in learners' },
  { label: 'Student Rate', token: '[Student Rate]', desc: 'Per-student attendance incentive' },
  { label: 'Group Multiplier', token: '[Group Multiplier]', desc: 'Multiplier applied to group classes' },
  { label: 'Late Cancel %', token: '[Late Cancel %]', desc: 'Pay rate percentage on late cancellations' },
  { label: 'Rev Share %', token: '[Rev Share %]', desc: 'Percentage of verified session tuition' },
  { label: 'Penalties', token: '[Approved Penalties]', desc: 'Operations policy deductions' },
  { label: 'Adjustments', token: '[Adjustments]', desc: 'Manual bonus or one-time adjustment items' },
];

export function computeStandardFormula(params: {
  compensationModel: CompensationModel;
  baseSalary: number;
  classRate: number;
  hourlyRate: number;
  perStudentRate: number;
  revenuePercentage: number;
  groupMultiplier: number;
  lateCancelPercent: number;
}): string {
  const cur = '₹';
  const base = params.baseSalary || 0;
  const cRate = params.classRate || 0;
  const hRate = params.hourlyRate || 0;
  const sRate = params.perStudentRate || 0;
  const rev = params.revenuePercentage || 0;
  const grp = params.groupMultiplier || 1.0;
  const late = params.lateCancelPercent || 50;

  switch (params.compensationModel) {
    case 'PER_CLASS': {
      const grpStr = grp !== 1.0 ? ` × ${grp.toFixed(2)}x [Group]` : '';
      return `Gross = (Completed Classes × ${cur}${cRate.toFixed(2)}${grpStr}) + (Late Cancellations × ${cur}${cRate.toFixed(2)} × ${late}%) - Approved Penalties + Adjustments`;
    }
    case 'DURATION_BASED': {
      return `Gross = (Teaching Hours × ${cur}${hRate.toFixed(2)}/hr) - Approved Penalties + Adjustments`;
    }
    case 'PER_STUDENT': {
      return `Gross = (Attending Students × ${cur}${sRate.toFixed(2)}/student) - Approved Penalties + Adjustments`;
    }
    case 'FIXED_SALARY': {
      return `Gross = Monthly Base Salary (${cur}${base.toFixed(2)}) - Absence Deductions - Approved Penalties + Adjustments`;
    }
    case 'PERCENTAGE_BASED': {
      return `Gross = (Session Revenue Basis × ${rev.toFixed(1)}%) + (Late Cancellations × ${late}%) - Approved Penalties + Adjustments`;
    }
    case 'HYBRID': {
      const parts: string[] = [];
      if (base > 0) parts.push(`Base (${cur}${base.toFixed(2)})`);
      if (cRate > 0) parts.push(`(Classes × ${cur}${cRate.toFixed(2)}${grp !== 1.0 ? ` × ${grp.toFixed(2)}x Group` : ''})`);
      if (hRate > 0) parts.push(`(Hours × ${cur}${hRate.toFixed(2)})`);
      if (sRate > 0) parts.push(`(Students × ${cur}${sRate.toFixed(2)})`);
      if (rev > 0) parts.push(`(Revenue × ${rev.toFixed(1)}%)`);
      if (parts.length === 0) parts.push(`Base (${cur}0.00)`);
      return `Gross = ${parts.join(' + ')} - Approved Penalties + Adjustments`;
    }
    default:
      return `Gross = Base (${cur}${base.toFixed(2)}) + (Classes × ${cur}${cRate.toFixed(2)}) - Approved Penalties + Adjustments`;
  }
}

export function simulateGrossPayout(params: {
  compensationModel: CompensationModel;
  baseSalary: number;
  classRate: number;
  hourlyRate: number;
  perStudentRate: number;
  revenuePercentage: number;
  groupMultiplier: number;
}): number {
  const sampleClasses = 10;
  const sampleHours = 15;
  const sampleStudents = 8;
  const sampleTuition = 1500;

  let total = 0;
  switch (params.compensationModel) {
    case 'PER_CLASS':
      total = sampleClasses * params.classRate;
      break;
    case 'DURATION_BASED':
      total = sampleHours * params.hourlyRate;
      break;
    case 'PER_STUDENT':
      total = sampleStudents * params.perStudentRate;
      break;
    case 'FIXED_SALARY':
      total = params.baseSalary;
      break;
    case 'PERCENTAGE_BASED':
      total = sampleTuition * (params.revenuePercentage / 100);
      break;
    case 'HYBRID':
      total =
        params.baseSalary +
        sampleClasses * params.classRate +
        sampleHours * params.hourlyRate +
        sampleStudents * params.perStudentRate +
        sampleTuition * (params.revenuePercentage / 100);
      break;
  }
  return total;
}

export default function PayrollRulesPage() {
  const [plans, setPlans] = useState<PayrollPlan[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PayrollPlan | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Plan form fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState<CompensationModel>('PER_CLASS');
  const [currency, setCurrency] = useState('INR');
  const [baseSalary, setBaseSalary] = useState('0');
  const [classRate, setClassRate] = useState('65');
  const [hourlyRate, setHourlyRate] = useState('50');
  const [perStudentRate, setPerStudentRate] = useState('15');
  const [revenuePercentage, setRevenuePercentage] = useState('30');
  const [groupMultiplier, setGroupMultiplier] = useState('1.25');
  const [minDuration, setMinDuration] = useState('45');
  const [lateCancelPercent, setLateCancelPercent] = useState('50');

  // Formula state
  const [isCustomFormula, setIsCustomFormula] = useState(false);
  const [customFormulaText, setCustomFormulaText] = useState('');

  // Load plans on mount
  const refreshPlans = () => {
    setPlans([...db.getPayrollPlans()]);
  };

  useEffect(() => {
    refreshPlans();
  }, []);

  // Compute live auto-formula whenever numerical params or model changes
  const autoGeneratedFormula = computeStandardFormula({
    compensationModel: model,
    baseSalary: parseFloat(baseSalary) || 0,
    classRate: parseFloat(classRate) || 0,
    hourlyRate: parseFloat(hourlyRate) || 0,
    perStudentRate: parseFloat(perStudentRate) || 0,
    revenuePercentage: parseFloat(revenuePercentage) || 0,
    groupMultiplier: parseFloat(groupMultiplier) || 1.0,
    lateCancelPercent: parseFloat(lateCancelPercent) || 50,
  });

  // Effective formula string
  const activeFormula = isCustomFormula ? customFormulaText : autoGeneratedFormula;

  // Live payout simulation
  const simulatedPayout = simulateGrossPayout({
    compensationModel: model,
    baseSalary: parseFloat(baseSalary) || 0,
    classRate: parseFloat(classRate) || 0,
    hourlyRate: parseFloat(hourlyRate) || 0,
    perStudentRate: parseFloat(perStudentRate) || 0,
    revenuePercentage: parseFloat(revenuePercentage) || 0,
    groupMultiplier: parseFloat(groupMultiplier) || 1.0,
  });

  const openCreateModal = () => {
    setEditingPlanId(null);
    setName('');
    setCode('');
    setDescription('');
    setModel('PER_CLASS');
    setCurrency('INR');
    setBaseSalary('0');
    setClassRate('65');
    setHourlyRate('50');
    setPerStudentRate('15');
    setRevenuePercentage('30');
    setGroupMultiplier('1.25');
    setMinDuration('45');
    setLateCancelPercent('50');
    setIsCustomFormula(false);
    setCustomFormulaText('');
    setShowModal(true);
  };

  const openEditModal = (p: PayrollPlan) => {
    setEditingPlanId(p.id);
    setName(p.name);
    setCode(p.code);
    setDescription(p.description || '');
    setModel(p.compensationModel);
    setCurrency(p.currency || 'INR');
    setBaseSalary(String(p.baseSalary || 0));
    setClassRate(String(p.defaultClassRate || 0));
    setHourlyRate(String(p.hourlyRate || 0));
    setPerStudentRate(String(p.perStudentRate || 0));
    setRevenuePercentage(String(p.revenuePercentage || 0));
    setGroupMultiplier(String(p.groupMultiplier || 1.25));
    setMinDuration(String(p.minEligibleDurationMinutes || 30));
    setLateCancelPercent(String(p.lateCancellationPayPercent || 50));

    if (p.formula && p.formula.trim().length > 0) {
      setIsCustomFormula(true);
      setCustomFormulaText(p.formula);
    } else {
      setIsCustomFormula(false);
      setCustomFormulaText('');
    }
    setShowModal(true);
  };

  const handleInsertToken = (token: string) => {
    setIsCustomFormula(true);
    const baseText = customFormulaText || autoGeneratedFormula;
    setCustomFormulaText(`${baseText} + ${token}`);
  };

  const handleResetToAuto = () => {
    setIsCustomFormula(false);
    setCustomFormulaText('');
  };

  const handleCopyFormula = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSavePlan = async () => {
    if (!name.trim() || !code.trim()) {
      setStatusMsg({ type: 'error', text: 'Plan Name and Plan Code are required.' });
      return;
    }

    const formulaToSave = isCustomFormula ? customFormulaText.trim() : autoGeneratedFormula;

    try {
      if (editingPlanId) {
        // Edit existing plan
        db.updatePayrollPlan(
          editingPlanId,
          {
            name: name.trim(),
            code: code.trim().toUpperCase(),
            description: description.trim(),
            compensationModel: model,
            currency: currency,
            baseSalary: parseFloat(baseSalary) || 0,
            defaultClassRate: parseFloat(classRate) || 0,
            hourlyRate: parseFloat(hourlyRate) || 0,
            perStudentRate: parseFloat(perStudentRate) || 0,
            revenuePercentage: parseFloat(revenuePercentage) || 0,
            minEligibleDurationMinutes: parseInt(minDuration) || 30,
            lateCancellationPayPercent: parseFloat(lateCancelPercent) || 50,
            groupMultiplier: parseFloat(groupMultiplier) || 1.25,
            formula: formulaToSave,
          },
          true
        );
        setStatusMsg({ type: 'success', text: `Plan ${code} updated successfully.` });
      } else {
        // Create new plan
        db.createPayrollPlan({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
          compensationModel: model,
          currency: currency,
          baseSalary: parseFloat(baseSalary) || 0,
          defaultClassRate: parseFloat(classRate) || 0,
          hourlyRate: parseFloat(hourlyRate) || 0,
          perStudentRate: parseFloat(perStudentRate) || 0,
          revenuePercentage: parseFloat(revenuePercentage) || 0,
          minEligibleDurationMinutes: parseInt(minDuration) || 30,
          payableClassStatuses: ['COMPLETED', 'LATE_CANCELLED'],
          lateCancellationPayPercent: parseFloat(lateCancelPercent) || 50,
          groupMultiplier: parseFloat(groupMultiplier) || 1.25,
          formula: formulaToSave,
          effectiveFrom: new Date().toISOString(),
          isActive: true,
        });
        setStatusMsg({ type: 'success', text: `Plan ${code} configured and saved to database.` });
      }

      await db.persistNow();
      refreshPlans();
      setShowModal(false);
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save payroll plan.' });
    }
  };

  const handleDeletePlan = async (id: string, planCode: string) => {
    if (!confirm(`Are you sure you want to delete payroll plan ${planCode}?`)) return;
    try {
      const mentors = db.getMentors();
      const isUsed = mentors.some((m) => m.payrollPlanId === id);
      if (isUsed) {
        alert(`Cannot delete plan ${planCode} because active mentors are assigned to it.`);
        return;
      }
      db.deletePayrollPlan(id);
      await db.persistNow();
      refreshPlans();
      setStatusMsg({ type: 'success', text: `Plan ${planCode} deleted successfully.` });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete plan.' });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configurable Payroll Plans</h1>
            <p className="text-xs text-slate-500 mt-1">
              Multi-model compensation formulas, mathematical rule sets, eligibility criteria, and rate cards.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={openCreateModal}
          >
            Configure New Plan
          </Button>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-xs text-slate-400 hover:text-slate-600 ml-4 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Plans Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name & Version</TableHead>
                <TableHead>Compensation Model</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Class / Hourly Rates</TableHead>
                <TableHead className="min-w-[280px]">Compensation Formula</TableHead>
                <TableHead>Eligibility</TableHead>
                <TableHead>Late Cancel</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => {
                const planFormula =
                  p.formula ||
                  computeStandardFormula({
                    compensationModel: p.compensationModel,
                    baseSalary: p.baseSalary,
                    classRate: p.defaultClassRate,
                    hourlyRate: p.hourlyRate,
                    perStudentRate: p.perStudentRate,
                    revenuePercentage: p.revenuePercentage,
                    groupMultiplier: p.groupMultiplier,
                    lateCancelPercent: p.lateCancellationPayPercent,
                  });

                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <Badge variant="purple" size="sm">
                          v{p.version}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{p.code}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" size="sm">
                        {p.compensationModel.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono font-semibold text-slate-800">
                      {p.baseSalary > 0 ? formatCurrency(p.baseSalary) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {p.defaultClassRate > 0 && <span className="font-medium">{formatCurrency(p.defaultClassRate)}/class </span>}
                      {p.hourlyRate > 0 && <span className="font-medium">{formatCurrency(p.hourlyRate)}/hr </span>}
                      {p.perStudentRate > 0 && <span>+{formatCurrency(p.perStudentRate)}/student </span>}
                      {p.revenuePercentage > 0 && <span>{p.revenuePercentage}% rev-share</span>}
                      {p.groupMultiplier && p.groupMultiplier !== 1 && (
                        <span className="block text-[10px] text-indigo-600 font-medium mt-0.5">
                          {p.groupMultiplier}x group multiplier
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 group">
                        <div
                          className="font-mono text-[11px] bg-slate-900 text-emerald-300 px-2.5 py-1.5 rounded-md border border-slate-800 max-w-[280px] truncate"
                          title={planFormula}
                        >
                          {planFormula}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyFormula(planFormula, p.id)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Copy formula"
                        >
                          {copiedId === p.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      Min {p.minEligibleDurationMinutes}m
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 font-semibold">
                      {p.lateCancellationPayPercent}%
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPlan(p)}
                          className="text-xs"
                        >
                          Inspect
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(p)}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </Button>
                        <button
                          onClick={() => handleDeletePlan(p.id, p.code)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                          title="Delete plan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Configure / Edit Plan Modal */}
        {showModal && (
          <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            maxWidth="xl"
            title={editingPlanId ? 'Edit Mentor Payroll Plan & Formula' : 'Configure New Mentor Payroll Plan'}
            subtitle="Define compensation rules, instructional rate cards, and configure mathematical formula parameters."
            footer={
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] text-slate-500 font-medium">
                  {isCustomFormula ? 'Customized formula set' : 'Standard dynamic formula active'}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSavePlan} disabled={!name || !code}>
                    {editingPlanId ? 'Update Payroll Plan' : 'Save Payroll Plan'}
                  </Button>
                </div>
              </div>
            }
          >
            <div className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
              {/* Row 1: Plan Name and Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Plan Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior STEM Master Mentor"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Plan Code *</label>
                  <input
                    type="text"
                    placeholder="PLAN-STEM-SR"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Plan Description</label>
                <input
                  type="text"
                  placeholder="e.g. Multi-tier hybrid plan for full-time senior instructors with student bonuses."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Compensation Model */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Compensation Model *</label>
                <select
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value as CompensationModel);
                    if (!isCustomFormula) {
                      setCustomFormulaText('');
                    }
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="PER_CLASS">A. Per-Class Payroll (Fixed payment per completed session)</option>
                  <option value="DURATION_BASED">B. Duration-Based Payroll (Hourly teaching rate)</option>
                  <option value="PER_STUDENT">C. Per-Student Payroll (Direct rate per attending student)</option>
                  <option value="FIXED_SALARY">D. Fixed Monthly Salary (Guaranteed base salary with proration)</option>
                  <option value="PERCENTAGE_BASED">E. Percentage-Based (Direct tuition revenue share)</option>
                  <option value="HYBRID">F. Hybrid Payroll (Base salary + class incentives + student bonuses)</option>
                </select>
              </div>

              {/* Dynamic Rates Configuration Inputs */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Rate Card & Compensation Inputs
                  </span>
                  <Badge variant="purple" size="sm">
                    Currency: {currency}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(model === 'FIXED_SALARY' || model === 'HYBRID') && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Monthly Base Salary (₹)</label>
                      <input
                        type="number"
                        value={baseSalary}
                        onChange={(e) => setBaseSalary(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}

                  {(model === 'PER_CLASS' || model === 'HYBRID') && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Rate per Class (₹)</label>
                      <input
                        type="number"
                        value={classRate}
                        onChange={(e) => setClassRate(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}

                  {(model === 'DURATION_BASED' || model === 'HYBRID') && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Hourly Teaching Rate (₹/hr)</label>
                      <input
                        type="number"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}

                  {(model === 'PER_STUDENT' || model === 'HYBRID') && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Rate per Attending Student (₹)</label>
                      <input
                        type="number"
                        value={perStudentRate}
                        onChange={(e) => setPerStudentRate(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}

                  {(model === 'PERCENTAGE_BASED' || model === 'HYBRID') && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Revenue Share %</label>
                      <input
                        type="number"
                        value={revenuePercentage}
                        onChange={(e) => setRevenuePercentage(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Group Session Multiplier</label>
                    <input
                      type="number"
                      step="0.05"
                      value={groupMultiplier}
                      onChange={(e) => setGroupMultiplier(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      placeholder="1.25"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Min Duration (mins)</label>
                    <input
                      type="number"
                      value={minDuration}
                      onChange={(e) => setMinDuration(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Late Cancel Pay %</label>
                    <input
                      type="number"
                      value={lateCancelPercent}
                      onChange={(e) => setLateCancelPercent(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* CORE REQUIREMENT: FORMULA DISPLAY & CONFIGURATION BOX */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-white shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs text-slate-100">
                      Payroll Compensation Formula
                    </span>
                    <Badge variant={isCustomFormula ? 'purple' : 'success'} size="sm">
                      {isCustomFormula ? 'Custom Expression' : 'Standard Formula'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCustomFormula ? (
                      <button
                        type="button"
                        onClick={handleResetToAuto}
                        className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset to standard formula
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomFormula(true);
                          setCustomFormulaText(autoGeneratedFormula);
                        }}
                        className="text-[11px] text-slate-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" /> Set custom formula
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Mathematical equation executed by the payroll engine during batch calculations.
                </p>

                {/* Live Formula Display Screen */}
                <div className="p-3 bg-slate-950/90 rounded-lg border border-slate-800 font-mono text-xs leading-relaxed text-emerald-300 flex items-start justify-between gap-2">
                  <span className="break-all">{activeFormula}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyFormula(activeFormula, 'modal')}
                    className="p-1 rounded text-slate-500 hover:text-emerald-400 shrink-0 transition-colors"
                    title="Copy formula"
                  >
                    {copiedId === 'modal' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Custom Formula Editor & Variables Picker */}
                {isCustomFormula && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-slate-300 font-semibold">
                        Set / Edit Custom Mathematical Expression:
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Supports arithmetic operators (+, -, *, /) and tokens
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      value={customFormulaText}
                      onChange={(e) => setCustomFormulaText(e.target.value)}
                      placeholder="e.g. Gross = Base + (ClassesCount * ClassRate) + Bonuses - ApprovedPenalties"
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:border-purple-500 leading-relaxed"
                    />

                    {/* Variable Tokens Chips */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        <Code2 className="w-3 h-3 text-purple-400" /> Click to Insert Formula Token:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {FORMULA_TOKENS.map((item) => (
                          <button
                            key={item.token}
                            type="button"
                            onClick={() => handleInsertToken(item.token)}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-purple-500 transition-colors"
                            title={item.desc}
                          >
                            + {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Simulation Summary Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Sample Simulation (10 classes, 15h teaching, 8 students):
                  </span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {formatCurrency(simulatedPayout)}
                  </span>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Inspect Plan Modal */}
        {selectedPlan && (
          <Modal
            isOpen={Boolean(selectedPlan)}
            onClose={() => setSelectedPlan(null)}
            maxWidth="lg"
            title={selectedPlan.name}
            subtitle={`Plan Code: ${selectedPlan.code} • Version: v${selectedPlan.version}`}
            footer={
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const planToEdit = selectedPlan;
                    setSelectedPlan(null);
                    openEditModal(planToEdit);
                  }}
                  leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                >
                  Edit This Plan & Formula
                </Button>
                <Button variant="primary" size="sm" onClick={() => setSelectedPlan(null)}>
                  Close
                </Button>
              </div>
            }
          >
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">{selectedPlan.description || 'No description provided.'}</p>

              {/* Formula Block */}
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    <p className="font-bold text-xs text-slate-100">Configured Mathematical Formula:</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyFormula(
                        selectedPlan.formula ||
                          computeStandardFormula({
                            compensationModel: selectedPlan.compensationModel,
                            baseSalary: selectedPlan.baseSalary,
                            classRate: selectedPlan.defaultClassRate,
                            hourlyRate: selectedPlan.hourlyRate,
                            perStudentRate: selectedPlan.perStudentRate,
                            revenuePercentage: selectedPlan.revenuePercentage,
                            groupMultiplier: selectedPlan.groupMultiplier,
                            lateCancelPercent: selectedPlan.lateCancellationPayPercent,
                          }),
                        'inspect'
                      )
                    }
                    className="p-1 rounded text-slate-400 hover:text-emerald-400"
                    title="Copy formula"
                  >
                    {copiedId === 'inspect' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="font-mono text-xs bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed text-emerald-300">
                  {selectedPlan.formula ||
                    computeStandardFormula({
                      compensationModel: selectedPlan.compensationModel,
                      baseSalary: selectedPlan.baseSalary,
                      classRate: selectedPlan.defaultClassRate,
                      hourlyRate: selectedPlan.hourlyRate,
                      perStudentRate: selectedPlan.perStudentRate,
                      revenuePercentage: selectedPlan.revenuePercentage,
                      groupMultiplier: selectedPlan.groupMultiplier,
                      lateCancelPercent: selectedPlan.lateCancellationPayPercent,
                    })}
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <p className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                  Compensation Model Parameters
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Model</span>
                    <span className="font-semibold text-slate-800">
                      {selectedPlan.compensationModel.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Base Salary</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPlan.baseSalary > 0 ? formatCurrency(selectedPlan.baseSalary) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Class Rate</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPlan.defaultClassRate > 0 ? formatCurrency(selectedPlan.defaultClassRate) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Hourly Rate</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPlan.hourlyRate > 0 ? formatCurrency(selectedPlan.hourlyRate) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Per-Student Rate</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPlan.perStudentRate > 0 ? formatCurrency(selectedPlan.perStudentRate) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Group Multiplier</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPlan.groupMultiplier}x
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Late Cancel Pay</span>
                    <span className="font-semibold text-slate-800">
                      {selectedPlan.lateCancellationPayPercent}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Min Session Duration</span>
                    <span className="font-semibold text-slate-800">
                      {selectedPlan.minEligibleDurationMinutes} mins
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Version</span>
                    <span className="font-semibold text-indigo-600">v{selectedPlan.version}</span>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}
