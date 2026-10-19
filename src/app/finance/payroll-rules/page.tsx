'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { PayrollPlan, CompensationModel } from '../../../lib/types/payroll';
import { Sliders, Plus, CheckCircle2, History } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils/formatters';

export default function PayrollRulesPage() {
  const [plans, setPlans] = useState<PayrollPlan[]>(db.getPayrollPlans());
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PayrollPlan | null>(null);

  // New plan state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState<CompensationModel>('PER_CLASS');
  const [baseSalary, setBaseSalary] = useState('0');
  const [classRate, setClassRate] = useState('65');
  const [hourlyRate, setHourlyRate] = useState('50');
  const [perStudentRate, setPerStudentRate] = useState('15');
  const [revenuePercentage, setRevenuePercentage] = useState('30');
  const [minDuration, setMinDuration] = useState('45');
  const [lateCancelPercent, setLateCancelPercent] = useState('50');

  const handleCreatePlan = () => {
    if (!name.trim() || !code.trim()) return;
    const newPlan = db.createPayrollPlan({
      name,
      code,
      description,
      compensationModel: model,
      currency: 'USD',
      baseSalary: parseFloat(baseSalary) || 0,
      defaultClassRate: parseFloat(classRate) || 0,
      hourlyRate: parseFloat(hourlyRate) || 0,
      perStudentRate: parseFloat(perStudentRate) || 0,
      revenuePercentage: parseFloat(revenuePercentage) || 0,
      minEligibleDurationMinutes: parseInt(minDuration) || 30,
      payableClassStatuses: ['COMPLETED', 'LATE_CANCELLED'],
      lateCancellationPayPercent: parseFloat(lateCancelPercent) || 50,
      groupMultiplier: 1.25,
      effectiveFrom: new Date().toISOString(),
      isActive: true,
    });
    setPlans(db.getPayrollPlans());
    setShowModal(false);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configurable Payroll Plans</h1>
            <p className="text-xs text-slate-500 mt-1">
              Multi-model compensation formulas, versioned rule sets, eligibility criteria, and rate cards.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowModal(true)}
          >
            Create New Plan
          </Button>
        </div>

        {/* Plans Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan Name & Version</TableHead>
              <TableHead>Compensation Model</TableHead>
              <TableHead>Base Salary</TableHead>
              <TableHead>Class / Hourly Rates</TableHead>
              <TableHead>Eligibility Threshold</TableHead>
              <TableHead>Late Cancel Policy</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => (
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
                  {p.defaultClassRate > 0 && <span>${p.defaultClassRate}/class </span>}
                  {p.hourlyRate > 0 && <span>${p.hourlyRate}/hr </span>}
                  {p.perStudentRate > 0 && <span>+${p.perStudentRate}/student </span>}
                  {p.revenuePercentage > 0 && <span>{p.revenuePercentage}% rev-share</span>}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  Min {p.minEligibleDurationMinutes} mins
                </TableCell>
                <TableCell className="text-xs text-slate-700 font-semibold">
                  {p.lateCancellationPayPercent}% pay
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {formatDate(p.effectiveFrom)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelectedPlan(p)}>
                    Inspect Formula
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Create Plan Modal */}
        {showModal && (
          <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            maxWidth="lg"
            title="Configure New Mentor Payroll Plan"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreatePlan} disabled={!name || !code}>
                  Save Payroll Plan
                </Button>
              </div>
            }
          >
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Plan Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Executive STEM Lead"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Plan Code *</label>
                  <input
                    type="text"
                    placeholder="PLAN-STEM-EXEC"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Compensation Model *</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as CompensationModel)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="PER_CLASS">A. Per-Class Payroll (Fixed $/class)</option>
                  <option value="DURATION_BASED">B. Duration-Based Payroll ($/hour)</option>
                  <option value="PER_STUDENT">C. Per-Student Payroll ($/student)</option>
                  <option value="FIXED_SALARY">D. Fixed Monthly Salary</option>
                  <option value="PERCENTAGE_BASED">E. Percentage-Based (Revenue Share)</option>
                  <option value="HYBRID">F. Hybrid Payroll (Base + Incentives)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(model === 'FIXED_SALARY' || model === 'HYBRID') && (
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Monthly Base Salary ($)</label>
                    <input
                      type="number"
                      value={baseSalary}
                      onChange={(e) => setBaseSalary(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                )}
                {(model === 'PER_CLASS' || model === 'HYBRID') && (
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Rate per Class ($)</label>
                    <input
                      type="number"
                      value={classRate}
                      onChange={(e) => setClassRate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                )}
                {(model === 'DURATION_BASED' || model === 'HYBRID') && (
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Hourly Teaching Rate ($/hr)</label>
                    <input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                )}
                {(model === 'PER_STUDENT' || model === 'HYBRID') && (
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Rate per Attending Student ($)</label>
                    <input
                      type="number"
                      value={perStudentRate}
                      onChange={(e) => setPerStudentRate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
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
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Minimum Duration (mins)</label>
                  <input
                    type="number"
                    value={minDuration}
                    onChange={(e) => setMinDuration(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Late Cancellation Pay %</label>
                  <input
                    type="number"
                    value={lateCancelPercent}
                    onChange={(e) => setLateCancelPercent(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
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
            title={selectedPlan.name}
            subtitle={`Plan Version: v${selectedPlan.version} • Code: ${selectedPlan.code}`}
            footer={
              <Button variant="outline" size="sm" onClick={() => setSelectedPlan(null)}>
                Close
              </Button>
            }
          >
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">{selectedPlan.description}</p>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-900">Mathematical Calculation Formula:</p>
                <div className="font-mono text-[11px] bg-slate-900 text-emerald-400 p-3 rounded-lg leading-relaxed">
                  Gross = Base ({formatCurrency(selectedPlan.baseSalary)}) + (Classes × {formatCurrency(selectedPlan.defaultClassRate)}) + (Hours × {formatCurrency(selectedPlan.hourlyRate)}) + Bonuses - Approved Penalties
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}
