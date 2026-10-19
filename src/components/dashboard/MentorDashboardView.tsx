'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { db } from '../../lib/db/store';
import { payrollEngine } from '../../lib/payroll/engine';
import { StatCard } from '../ui/StatCard';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { CalendarEventModal } from '../calendar/CalendarEventModal';
import { PayslipViewer } from '../payroll/PayslipViewer';
import {
  Calendar,
  Clock,
  DollarSign,
  ShieldAlert,
  FileText,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { formatCurrency, formatDuration, formatDate, formatTime } from '../../lib/utils/formatters';
import { ClassEvent } from '../../lib/types/models';
import { Payslip } from '../../lib/types/payroll';

export function MentorDashboardView() {
  const { currentUser } = useAuth();
  const mentor = db.getMentors().find((m) => m.id === currentUser.mentorId) || db.getMentors()[0];
  const plans = db.getPayrollPlans();
  const mentorPlan = plans.find((p) => p.id === mentor.payrollPlanId) || plans[0];

  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTargetId, setDisputeTargetId] = useState('');
  const [disputeNote, setDisputeNote] = useState('');

  // Mentor's classes
  const classes = db.getClasses({ mentorId: mentor.id });
  const completedClasses = classes.filter((c) => c.status === 'COMPLETED');
  const upcomingClasses = classes.filter((c) => c.status === 'SCHEDULED');

  // Current Cycle Estimate (Oct 16 - Oct 31, 2026)
  const currentEstimate = useMemo(() => {
    return payrollEngine.calculateMentorPayroll(
      mentor,
      mentorPlan,
      classes,
      '2026-10-16',
      '2026-10-31',
      'batch-preview'
    );
  }, [mentor, mentorPlan, classes]);

  // Mentor's penalties and disputes
  const penalties = db.getPenalties(mentor.id);
  const disputes = penalties.filter((p) => p.disputeStatus === 'DISPUTED');

  // Mentor's finalized payslips
  const payslips = db.getPayslips(mentor.id);
  const latestPayslip = payslips[0] || null;

  const handleOpenDispute = (penId: string) => {
    setDisputeTargetId(penId);
    setDisputeModalOpen(true);
  };

  const handleSubmitDispute = () => {
    if (!disputeNote.trim()) return;
    db.disputePenalty(disputeTargetId, disputeNote);
    db.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: 'MENTOR',
      action: 'PENALTY_DISPUTED',
      entityType: 'Penalty',
      entityId: disputeTargetId,
      details: `Mentor raised dispute: ${disputeNote}`,
    });
    setDisputeModalOpen(false);
    setDisputeNote('');
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider font-semibold text-indigo-300">
              Personal Mentor Portal
            </span>
            <Badge variant="purple" size="sm">
              {mentorPlan.name}
            </Badge>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Welcome back, {mentor.firstName}!
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Campus: {mentor.branchName || 'Manhattan Campus'} • Model: {mentorPlan.compensationModel}
          </p>
        </div>

        {latestPayslip && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileText className="w-4 h-4 text-indigo-600" />}
            onClick={() => setSelectedPayslip(latestPayslip)}
          >
            View Latest Payslip ({latestPayslip.payslipNumber})
          </Button>
        )}
      </div>

      {/* Current Cycle Estimate Notice */}
      <Alert
        type="info"
        title="Current Cycle Status: October 2026 - Cycle 2 (Oct 16 - Oct 31)"
        message="Figures shown below reflect completed classes and active bookings to date. Final compensation will be officially calculated and finalized upon payroll cutoff on October 31."
      />

      {/* Cycle KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Completed Classes"
          value={completedClasses.length}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          subtitle="This billing period"
        />
        <StatCard
          title="Teaching Duration"
          value={formatDuration(currentEstimate.eligibleDurationMinutes || 120)}
          icon={<Clock className="w-5 h-5" />}
          color="indigo"
          subtitle="Eligible instruction time"
        />
        <StatCard
          title="Estimated Gross"
          value={formatCurrency(currentEstimate.grossEarnings)}
          icon={<DollarSign className="w-5 h-5" />}
          color="indigo"
          subtitle="Unfinalized estimate"
        />
        <StatCard
          title="Estimated Net Payable"
          value={formatCurrency(currentEstimate.netPayable)}
          icon={<DollarSign className="w-5 h-5" />}
          color="emerald"
          subtitle="After approved deductions"
        />
      </div>

      {/* Main Split: Schedule & Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Classes / Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="My Upcoming Sessions"
            subtitle="Scheduled classes requiring student check-in"
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {upcomingClasses.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  You have no pending classes scheduled this week.
                </div>
              ) : (
                upcomingClasses.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedEvent(cls)}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{cls.title}</p>
                      <p className="text-slate-500 mt-0.5">
                        {formatDate(cls.startTime)} at {formatTime(cls.startTime)} ({cls.durationMinutes} mins)
                      </p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Students: {cls.students.map((s) => s.studentName).join(', ') || 'Roster pending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        Mark Attendance
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Penalties, Disputes & Compensation Breakdown */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Applied Deductions & Penalties"
              subtitle="Authorized deductions impacting current payroll"
            />
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 text-xs">
                {penalties.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    No penalties or infractions recorded. Excellent work!
                  </div>
                ) : (
                  penalties.map((pen) => (
                    <div key={pen.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {pen.category.replace(/_/g, ' ')}
                        </span>
                        <span className="font-bold text-rose-600">-{formatCurrency(pen.amount)}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">{pen.reason}</p>
                      <div className="flex items-center justify-between pt-1">
                        <Badge
                          variant={
                            pen.status === 'APPROVED' || pen.status === 'APPLIED'
                              ? 'danger'
                              : pen.status === 'REVERSED'
                              ? 'purple'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {pen.status}
                        </Badge>
                        {pen.status !== 'REVERSED' && pen.disputeStatus !== 'DISPUTED' && (
                          <button
                            onClick={() => handleOpenDispute(pen.id)}
                            className="text-indigo-600 hover:text-indigo-800 text-[11px] underline font-medium"
                          >
                            Dispute Deduction
                          </button>
                        )}
                        {pen.disputeStatus === 'DISPUTED' && (
                          <span className="text-amber-600 text-[11px] font-semibold">Dispute Under Review</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Finalized Payslips History */}
          <Card>
            <CardHeader
              title="My Finalized Payslips"
              subtitle="Official historical payment documents"
            />
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 text-xs">
                {payslips.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">No finalized payslips available yet.</div>
                ) : (
                  payslips.map((slip) => (
                    <div
                      key={slip.id}
                      onClick={() => setSelectedPayslip(slip)}
                      className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{slip.periodName}</p>
                        <p className="text-slate-400 text-[11px]">Ref: {slip.payslipNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{formatCurrency(slip.netPayable)}</p>
                        <Badge variant="success" size="sm">
                          {slip.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dispute Modal */}
      {disputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Raise Penalty Dispute</h3>
            <p className="text-xs text-slate-500">
              Provide your explanation or supporting evidence. An administrator will review your statement prior to final payroll lock.
            </p>
            <textarea
              rows={3}
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
              placeholder="State your reasons or details for dispute..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDisputeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitDispute}
                disabled={!disputeNote.trim()}
              >
                Submit Dispute
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Class Modal & Payslip Modal */}
      <CalendarEventModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        classEvent={selectedEvent}
        onSave={(updated) => {
          db.updateClass(updated.id, updated);
          setSelectedEvent(null);
        }}
      />

      <PayslipViewer
        isOpen={Boolean(selectedPayslip)}
        onClose={() => setSelectedPayslip(null)}
        payslip={selectedPayslip}
      />
    </div>
  );
}
