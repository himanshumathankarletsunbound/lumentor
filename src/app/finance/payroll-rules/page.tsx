'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { PayrollPlan, CompensationModel } from '../../../lib/types/payroll';
import {
  Sliders,
  Plus,
  CheckCircle2,
  Calculator,
  Edit3,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Trash2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils/formatters';

interface FormulaToken {
  label: string;
  token: string;
  desc: string;
}

const FORMULA_TOKENS: FormulaToken[] = [
  { label: 'Base', token: '[Base Salary]', desc: 'Fixed monthly base salary' },
  { label: 'Classes', token: '[Classes Count]', desc: 'Completed sessions' },
  { label: 'Class Rate', token: '[Class Rate]', desc: 'Rate per class' },
  { label: 'Hours', token: '[Teaching Hours]', desc: 'Instructional teaching hours' },
  { label: 'Hourly Rate', token: '[Hourly Rate]', desc: 'Hourly pay rate' },
  { label: 'Students', token: '[Attending Students]', desc: 'Present learners count' },
  { label: 'Student Rate', token: '[Student Rate]', desc: 'Per-student rate' },
  { label: 'Group Multiplier', token: '[Group Multiplier]', desc: 'Group multiplier' },
  { label: 'Late Cancel %', token: '[Late Cancel %]', desc: 'Late cancel pay percentage' },
  { label: 'Rev Share %', token: '[Rev Share %]', desc: 'Revenue share percentage' },
  { label: 'Deductions', token: '[Approved Penalties]', desc: 'Policy penalties' },
  { label: 'Bonuses', token: '[Adjustments]', desc: 'Manual bonus adjustments' },
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
      const grpStr = grp !== 1.0 ? ` × ${grp.toFixed(2)}x` : '';
      return `Gross = (Classes × ${cur}${cRate.toFixed(2)}${grpStr}) + (Late Cancel × ${cur}${cRate.toFixed(2)} × ${late}%) - Deductions`;
    }
    case 'DURATION_BASED': {
      return `Gross = (Hours × ${cur}${hRate.toFixed(2)}/hr) - Deductions`;
    }
    case 'PER_STUDENT': {
      return `Gross = (Students × ${cur}${sRate.toFixed(2)}/student) - Deductions`;
    }
    case 'FIXED_SALARY': {
      return `Gross = Base (${cur}${base.toFixed(2)}/mo) - Absence Deductions - Penalties`;
    }
    case 'PERCENTAGE_BASED': {
      return `Gross = (Session Revenue × ${rev.toFixed(1)}%) + (Late Cancel × ${late}%) - Deductions`;
    }
    case 'HYBRID': {
      const parts: string[] = [];
      if (base > 0) parts.push(`Base (${cur}${base.toFixed(2)})`);
      if (cRate > 0) parts.push(`(Classes × ${cur}${cRate.toFixed(2)}${grp !== 1.0 ? ` × ${grp.toFixed(2)}x` : ''})`);
      if (hRate > 0) parts.push(`(Hours × ${cur}${hRate.toFixed(2)})`);
      if (sRate > 0) parts.push(`(Students × ${cur}${sRate.toFixed(2)})`);
      if (rev > 0) parts.push(`(Revenue × ${rev.toFixed(1)}%)`);
      if (parts.length === 0) parts.push(`Base (${cur}0.00)`);
      return `Gross = ${parts.join(' + ')} - Deductions + Adjustments`;
    }
    default:
      return `Gross = Base (${cur}${base.toFixed(2)}) + (Classes × ${cur}${cRate.toFixed(2)}) - Deductions`;
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
      total = sampleClasses * params.classRate * (params.groupMultiplier || 1.0);
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
        sampleClasses * params.classRate * (params.groupMultiplier || 1.0) +
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
        setStatusMsg({ type: 'success', text: `Plan ${code} configured and saved.` });
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
      <div className="space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mentor Payroll Plans</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-model compensation formulas, rate cards, and mathematical rule sets.
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

        {/* Streamlined Plans Table: Fits perfectly on all screens without horizontal scroll */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Plan & Model</TableHead>
              <TableHead className="w-[26%]">Compensation Rates</TableHead>
              <TableHead className="w-[24%]">Calculation Formula</TableHead>
              <TableHead className="w-[10%]">Policy</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-slate-700 text-sm">No payroll plans configured</p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Create your first mentor payroll plan with customizable compensation models and mathematical calculation formulas.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={openCreateModal}
                      className="mt-2"
                    >
                      Configure New Plan
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              plans.map((p) => {
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
                    {/* Column 1: Plan Details & Model */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 text-xs">{p.name}</span>
                        <Badge variant="purple" size="sm">
                          v{p.version}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400 font-mono">{p.code}</span>
                        <span className="text-slate-300">•</span>
                        <Badge variant="default" size="sm">
                          {p.compensationModel.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Column 2: Compensation Rates */}
                    <TableCell className="text-xs text-slate-700">
                      <div className="space-y-0.5">
                        {p.baseSalary > 0 && (
                          <div className="font-semibold text-slate-900 font-mono">
                            Base: {formatCurrency(p.baseSalary, 'INR')}/mo
                          </div>
                        )}
                        <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-2 gap-y-0.5">
                          {p.defaultClassRate > 0 && <span>₹{p.defaultClassRate}/class</span>}
                          {p.hourlyRate > 0 && <span>₹{p.hourlyRate}/hr</span>}
                          {p.perStudentRate > 0 && <span>+₹{p.perStudentRate}/student</span>}
                          {p.revenuePercentage > 0 && <span>{p.revenuePercentage}% rev</span>}
                          {p.groupMultiplier && p.groupMultiplier !== 1 && (
                            <span className="text-indigo-600 font-medium">{p.groupMultiplier}x group</span>
                          )}
                          {!p.baseSalary && !p.defaultClassRate && !p.hourlyRate && !p.perStudentRate && !p.revenuePercentage && (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Column 3: Calculation Formula (Compact, elegant, clickable pill) */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPlan(p)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-[11px] font-mono text-slate-700 hover:text-indigo-900 transition-colors max-w-[210px] truncate text-left"
                          title="Click to inspect full formula"
                        >
                          <Calculator className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{planFormula}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyFormula(planFormula, p.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
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

                    {/* Column 4: Eligibility & Policy */}
                    <TableCell className="text-xs text-slate-600">
                      <div>Min {p.minEligibleDurationMinutes}m</div>
                      <div className="text-[11px] text-slate-400">{p.lateCancellationPayPercent}% late pay</div>
                    </TableCell>

                    {/* Column 5: Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPlan(p)}
                          className="text-xs h-7 px-2 text-slate-600 hover:text-slate-900"
                          title="Inspect Formula"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(p)}
                          className="text-xs h-7 px-2 text-indigo-600 hover:text-indigo-800"
                          title="Edit Plan & Formula"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <button
                          onClick={() => handleDeletePlan(p.id, p.code)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete plan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Redesigned Edit / Configure Plan Modal (Clean, Cohesive Light Theme) */}
        {showModal && (
          <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            maxWidth="lg"
            title={editingPlanId ? 'Edit Mentor Payroll Plan' : 'Configure New Mentor Payroll Plan'}
            subtitle="Configure compensation structure, rate cards, and mathematical payout formulas."
            footer={
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] text-slate-400 font-medium">
                  {isCustomFormula ? 'Custom formula expression active' : 'Auto-computed formula active'}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSavePlan} disabled={!name || !code}>
                    {editingPlanId ? 'Update Plan' : 'Save Plan'}
                  </Button>
                </div>
              </div>
            }
          >
            <div className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
              {/* Section 1: Plan Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Plan Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior STEM Master Mentor"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Plan Code *</label>
                  <input
                    type="text"
                    placeholder="PLAN-STEM-SR"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Hybrid plan with fixed base salary plus per-class incentives and student bonuses."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Section 2: Compensation Model */}
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
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:border-indigo-500 focus:outline-none text-slate-800"
                >
                  <option value="PER_CLASS">A. Per-Class Payroll (Fixed payment per completed session)</option>
                  <option value="DURATION_BASED">B. Duration-Based Payroll (Hourly teaching rate)</option>
                  <option value="PER_STUDENT">C. Per-Student Payroll (Direct rate per attending student)</option>
                  <option value="FIXED_SALARY">D. Fixed Monthly Salary (Guaranteed base salary with proration)</option>
                  <option value="PERCENTAGE_BASED">E. Percentage-Based (Direct tuition revenue share)</option>
                  <option value="HYBRID">F. Hybrid Payroll (Base salary + class incentives + student bonuses)</option>
                </select>
              </div>

              {/* Section 3: Rate Configuration Card (Clean, aligned 2-col inputs) */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Rate Card & Parameter Inputs
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Currency: INR (₹)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(model === 'FIXED_SALARY' || model === 'HYBRID') && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Monthly Base Salary
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs text-slate-400">₹</span>
                        <input
                          type="number"
                          value={baseSalary}
                          onChange={(e) => setBaseSalary(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-indigo-500 focus:outline-none"
                          placeholder="2500"
                        />
                      </div>
                    </div>
                  )}

                  {(model === 'PER_CLASS' || model === 'HYBRID') && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Rate per Completed Class
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs text-slate-400">₹</span>
                        <input
                          type="number"
                          value={classRate}
                          onChange={(e) => setClassRate(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-indigo-500 focus:outline-none"
                          placeholder="65"
                        />
                      </div>
                    </div>
                  )}

                  {(model === 'DURATION_BASED' || model === 'HYBRID') && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Hourly Teaching Rate
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs text-slate-400">₹</span>
                        <input
                          type="number"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                          className="w-full pl-7 pr-10 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-indigo-500 focus:outline-none"
                          placeholder="50"
                        />
                        <span className="absolute right-3 top-2 text-[10px] text-slate-400">/hr</span>
                      </div>
                    </div>
                  )}

                  {(model === 'PER_STUDENT' || model === 'HYBRID') && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Rate per Attending Student
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs text-slate-400">₹</span>
                        <input
                          type="number"
                          value={perStudentRate}
                          onChange={(e) => setPerStudentRate(e.target.value)}
                          className="w-full pl-7 pr-14 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-indigo-500 focus:outline-none"
                          placeholder="15"
                        />
                        <span className="absolute right-3 top-2 text-[10px] text-slate-400">/student</span>
                      </div>
                    </div>
                  )}

                  {(model === 'PERCENTAGE_BASED' || model === 'HYBRID') && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Revenue Share Percentage
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={revenuePercentage}
                          onChange={(e) => setRevenuePercentage(e.target.value)}
                          className="w-full pl-3 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-indigo-500 focus:outline-none"
                          placeholder="30"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Policies & Multipliers Subrow */}
                <div className="pt-2.5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Group Multiplier
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        value={groupMultiplier}
                        onChange={(e) => setGroupMultiplier(e.target.value)}
                        className="w-full pl-3 pr-6 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-indigo-500 focus:outline-none"
                        placeholder="1.25"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-400">x</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Min Duration
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={minDuration}
                        onChange={(e) => setMinDuration(e.target.value)}
                        className="w-full pl-3 pr-10 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-indigo-500 focus:outline-none"
                        placeholder="45"
                      />
                      <span className="absolute right-3 top-2 text-[10px] text-slate-400">mins</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Late Cancel Pay
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={lateCancelPercent}
                        onChange={(e) => setLateCancelPercent(e.target.value)}
                        className="w-full pl-3 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-indigo-500 focus:outline-none"
                        placeholder="50"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-400">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Mathematical Formula Card (Clean, refined light theme) */}
              <div className="bg-gradient-to-b from-indigo-50/50 via-slate-50/70 to-white border border-indigo-100 rounded-xl p-3.5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-slate-900">Calculation Formula</h4>
                      <p className="text-[11px] text-slate-500">Mathematical rule applied during payroll batch run</p>
                    </div>
                  </div>

                  {/* Mode switch */}
                  <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg text-[11px]">
                    <button
                      type="button"
                      onClick={handleResetToAuto}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        !isCustomFormula
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Auto Formula
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomFormula(true);
                        if (!customFormulaText) setCustomFormulaText(autoGeneratedFormula);
                      }}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        isCustomFormula
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Custom Formula
                    </button>
                  </div>
                </div>

                {/* Formula Display / Editor */}
                {!isCustomFormula ? (
                  <div className="p-3 bg-white border border-indigo-100 rounded-lg shadow-2xs flex items-center justify-between gap-2">
                    <div className="font-mono text-xs text-slate-800 leading-relaxed break-words flex-1">
                      {activeFormula}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyFormula(activeFormula, 'modal')}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 shrink-0 transition-colors"
                      title="Copy formula"
                    >
                      {copiedId === 'modal' ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={customFormulaText}
                      onChange={(e) => setCustomFormulaText(e.target.value)}
                      placeholder="e.g. Gross = Base + (ClassesCount * ClassRate) - Deductions"
                      className="w-full p-2.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed shadow-2xs"
                    />

                    {/* Variable tokens helper */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Click to Insert Variable:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {FORMULA_TOKENS.map((item) => (
                          <button
                            key={item.token}
                            type="button"
                            onClick={() => handleInsertToken(item.token)}
                            className="px-2 py-0.5 text-[10px] font-medium rounded bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 transition-colors shadow-2xs"
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
                <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Simulation (10 classes, 15h teaching, 8 students):
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {formatCurrency(simulatedPayout, 'INR')}
                  </span>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Inspect Plan Modal (Matching clean light theme) */}
        {selectedPlan && (
          <Modal
            isOpen={Boolean(selectedPlan)}
            onClose={() => setSelectedPlan(null)}
            maxWidth="md"
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
                  Edit This Plan
                </Button>
                <Button variant="primary" size="sm" onClick={() => setSelectedPlan(null)}>
                  Close
                </Button>
              </div>
            }
          >
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">{selectedPlan.description || 'No description provided.'}</p>

              {/* Clean Formula Card */}
              <div className="p-3.5 bg-gradient-to-b from-indigo-50/50 to-slate-50 border border-indigo-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    <span>Calculation Formula</span>
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
                    className="p-1 rounded text-slate-400 hover:text-slate-700"
                    title="Copy formula"
                  >
                    {copiedId === 'inspect' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="p-2.5 bg-white border border-indigo-100 rounded-lg font-mono text-xs text-slate-800 leading-relaxed break-words shadow-2xs">
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

              {/* Parameter Breakdown Grid */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <p className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                  Parameters & Thresholds
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Model</span>
                    <span className="font-semibold text-slate-800">
                      {selectedPlan.compensationModel.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Base Salary</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPlan.baseSalary > 0 ? formatCurrency(selectedPlan.baseSalary, 'INR') : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Class Rate</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPlan.defaultClassRate > 0 ? formatCurrency(selectedPlan.defaultClassRate, 'INR') : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Hourly Rate</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPlan.hourlyRate > 0 ? formatCurrency(selectedPlan.hourlyRate, 'INR') : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Per-Student</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPlan.perStudentRate > 0 ? formatCurrency(selectedPlan.perStudentRate, 'INR') : '-'}
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
                    <span className="text-slate-400 block text-[10px]">Min Duration</span>
                    <span className="font-semibold text-slate-800">
                      {selectedPlan.minEligibleDurationMinutes} mins
                    </span>
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
