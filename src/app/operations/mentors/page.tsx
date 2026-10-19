'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Tabs } from '../../../components/ui/Tabs';
import { Mentor } from '../../../lib/types/models';
import { GraduationCap, Mail, Phone, MapPin, DollarSign, Calendar, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDuration, formatDate } from '../../../lib/utils/formatters';

export default function MentorsPage() {
  const { hasPermission } = useAuth();
  const [mentors] = useState<Mentor[]>(db.getMentors());
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const plans = db.getPayrollPlans();
  const canViewPayroll = hasPermission('payroll_dashboard', 'view_sensitive_payroll');

  const mentorClasses = selectedMentor
    ? db.getClasses({ mentorId: selectedMentor.id })
    : [];
  const mentorPenalties = selectedMentor
    ? db.getPenalties(selectedMentor.id)
    : [];
  const mentorPayslips = selectedMentor
    ? db.getPayslips(selectedMentor.id)
    : [];

  const drawerTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'classes', label: `Classes (${mentorClasses.length})` },
    ...(canViewPayroll
      ? [
          { id: 'payroll', label: 'Payroll & Plan' },
          { id: 'penalties', label: `Penalties (${mentorPenalties.length})` },
          { id: 'payslips', label: `Payslips (${mentorPayslips.length})` },
        ]
      : []),
  ];

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mentors & Instructional Staff</h1>
            <p className="text-xs text-slate-500 mt-1">
              Faculty roster, branch assignments, payroll plan mappings, and teaching metrics.
            </p>
          </div>
        </div>

        {/* Mentors Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mentor</TableHead>
              <TableHead>Assigned Campus</TableHead>
              <TableHead>Assigned Payroll Plan</TableHead>
              <TableHead>Teaching Volume</TableHead>
              <TableHead>Attendance Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provenance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mentors.map((m) => {
              const plan = plans.find((p) => p.id === m.payrollPlanId);
              return (
                <TableRow
                  key={m.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedMentor(m);
                    setActiveTab('overview');
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {m.firstName[0]}
                        {m.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {m.firstName} {m.lastName}
                        </p>
                        <p className="text-[11px] text-slate-400">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 font-medium">
                    {m.branchName || 'Primary Campus'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="purple" size="sm">
                      {plan?.name || 'Default Plan'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-slate-700">
                    {m.teachingHoursThisMonth} hrs ({m.completedClassesCount} classes)
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-emerald-700">
                    {m.attendanceRate}%
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" dot>
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.provenance === 'CLASSCARD_SOURCED' ? (
                      <Badge variant="purple" size="sm">
                        Classcard
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Local
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">
                      View Profile
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Mentor Detail Drawer */}
        <Drawer
          isOpen={Boolean(selectedMentor)}
          onClose={() => setSelectedMentor(null)}
          title={
            selectedMentor
              ? `${selectedMentor.firstName} ${selectedMentor.lastName}`
              : 'Mentor Profile'
          }
          subtitle={selectedMentor ? `Mentor ID: ${selectedMentor.id}` : ''}
          width="lg"
        >
          {selectedMentor && (
            <div className="space-y-6">
              <Tabs tabs={drawerTabs} activeTab={activeTab} onChange={setActiveTab} />

              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-800">{selectedMentor.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-800">{selectedMentor.phone || 'No phone recorded'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-800">{selectedMentor.branchName}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <p className="text-slate-400 uppercase font-semibold text-[10px]">Teaching Volume</p>
                      <p className="text-base font-bold text-slate-900 mt-1">
                        {selectedMentor.teachingHoursThisMonth} hours
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {selectedMentor.completedClassesCount} classes completed
                      </p>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <p className="text-slate-400 uppercase font-semibold text-[10px]">Attendance Rate</p>
                      <p className="text-base font-bold text-emerald-600 mt-1">
                        {selectedMentor.attendanceRate}%
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Verified check-in rate</p>
                    </div>
                  </div>
                </div>
              )}

              {/* CLASSES TAB */}
              {activeTab === 'classes' && (
                <div className="space-y-2 text-xs">
                  {mentorClasses.map((cls) => (
                    <div key={cls.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{cls.title}</span>
                        <Badge variant={cls.status === 'COMPLETED' ? 'success' : 'info'} size="sm">
                          {cls.status}
                        </Badge>
                      </div>
                      <p className="text-slate-500">
                        {formatDate(cls.startTime)} • {cls.durationMinutes} mins • {cls.branchName}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* PAYROLL TAB */}
              {activeTab === 'payroll' && canViewPayroll && (
                <div className="space-y-4 text-xs">
                  {(() => {
                    const plan = plans.find((p) => p.id === selectedMentor.payrollPlanId);
                    if (!plan) return <p>No plan configured.</p>;
                    return (
                      <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-900 text-sm">{plan.name}</span>
                          <Badge variant="purple" size="sm">
                            v{plan.version}
                          </Badge>
                        </div>
                        <p className="text-indigo-800">{plan.description}</p>
                        <div className="pt-2 border-t border-indigo-200 grid grid-cols-2 gap-2 text-slate-700">
                          <div>Model: <strong>{plan.compensationModel}</strong></div>
                          <div>Min Duration: <strong>{plan.minEligibleDurationMinutes} mins</strong></div>
                          <div>Base Salary: <strong>{formatCurrency(plan.baseSalary)}</strong></div>
                          <div>Per Class: <strong>{formatCurrency(plan.defaultClassRate)}</strong></div>
                          <div>Hourly: <strong>{formatCurrency(plan.hourlyRate)}/hr</strong></div>
                          <div>Late Cancel Pay: <strong>{plan.lateCancellationPayPercent}%</strong></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* PENALTIES TAB */}
              {activeTab === 'penalties' && canViewPayroll && (
                <div className="space-y-2 text-xs">
                  {mentorPenalties.length === 0 ? (
                    <p className="text-slate-500">No penalties recorded for this mentor.</p>
                  ) : (
                    mentorPenalties.map((pen) => (
                      <div key={pen.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{pen.category.replace(/_/g, ' ')}</span>
                          <span className="font-bold text-rose-600">-{formatCurrency(pen.amount)}</span>
                        </div>
                        <p className="text-slate-600">{pen.reason}</p>
                        <Badge variant="danger" size="sm">{pen.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* PAYSLIPS TAB */}
              {activeTab === 'payslips' && canViewPayroll && (
                <div className="space-y-2 text-xs">
                  {mentorPayslips.length === 0 ? (
                    <p className="text-slate-500">No finalized payslips generated yet.</p>
                  ) : (
                    mentorPayslips.map((slip) => (
                      <div key={slip.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{slip.periodName}</p>
                          <p className="text-slate-400 text-[11px]">{slip.payslipNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900">{formatCurrency(slip.netPayable)}</p>
                          <Badge variant="success" size="sm">{slip.paymentStatus}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </Drawer>
      </div>
    </AppShell>
  );
}
