'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { db } from '../../lib/db/store';
import { StatCard } from '../ui/StatCard';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { CalendarEventModal } from '../calendar/CalendarEventModal';
import { PayslipViewer } from '../payroll/PayslipViewer';
import { WelcomeHeader } from './WelcomeHeader';
import {
  DollarSign,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency, formatDate, formatTime } from '../../lib/utils/formatters';
import { ClassEvent } from '../../lib/types/models';
import { Payslip } from '../../lib/types/payroll';

export function MentorDashboardView() {
  const { currentUser } = useAuth();
  const [mentor, setMentor] = useState<ReturnType<typeof db.getMentors>[number] | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTargetId, setDisputeTargetId] = useState('');
  const [disputeNote, setDisputeNote] = useState('');
  const [mentorReview, setMentorReview] = useState<{ auditScore: number | null; operationScore: number | null; totalScore: number | null } | null>(null);

  useEffect(() => {
    if (!currentUser.mentorId) return;
    const loadPortalData = async () => {
      const [mentorResponse, payslipResponse] = await Promise.all([
        fetch('/api/mentors'),
        fetch(`/api/payslips?mentorId=${encodeURIComponent(currentUser.mentorId || '')}`),
      ]);
      const mentorPayload = await mentorResponse.json();
      const payslipPayload = await payslipResponse.json();
      if (!mentorResponse.ok || !mentorPayload.success) throw new Error(mentorPayload.error || 'Unable to load your mentor profile.');
      if (!payslipResponse.ok || !payslipPayload.success) throw new Error(payslipPayload.error || 'Unable to load your payslips.');
      setMentor(mentorPayload.mentors.find((candidate: { id: string }) => candidate.id === currentUser.mentorId) || null);
      setPayslips(payslipPayload.payslips);
    };
    void loadPortalData().catch((error: unknown) => setDataError(error instanceof Error ? error.message : 'Unable to load mentor portal data.'));
  }, [currentUser.mentorId]);

  useEffect(() => {
    if (!currentUser.mentorId) {
      return;
    }
    fetch(`/api/mentor-reviews?period=${new Date().toISOString().slice(0, 7)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.success) setMentorReview(data.review || null);
      })
      .catch(() => setMentorReview(null));
  }, [currentUser.mentorId]);

  // Mentor's classes
  const classes = mentor ? db.getClasses({ mentorId: mentor.id }) : [];
  const completedClasses = classes.filter((c) => c.status === 'COMPLETED');
  const upcomingClasses = classes.filter((c) => c.status === 'SCHEDULED');

  // Mentor's penalties and disputes
  const penalties = mentor ? db.getPenalties(mentor.id) : [];

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
      <WelcomeHeader subtitle="Mentor workspace · Your finalized payroll, schedule, and review activity." />
      {dataError && <Alert type="error" title="Unable to load mentor portal data" message={dataError} />}
      {latestPayslip && <div className="flex justify-end"><Button variant="outline" size="sm" leftIcon={<FileText className="w-4 h-4" />} onClick={() => setSelectedPayslip(latestPayslip)}>View latest payslip ({latestPayslip.payslipNumber})</Button></div>}

      <Card>
        <CardHeader title="Monthly mentor review score" subtitle="Your points are shown after the Audit Team submits the review." />
        <CardContent>
          {mentorReview ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-xs text-slate-500">Audit points</p><p className="mt-1 text-xl font-bold text-slate-900">{mentorReview.auditScore ?? 'Pending'} / 3</p></div>
              <div><p className="text-xs text-slate-500">Operations points</p><p className="mt-1 text-xl font-bold text-slate-900">{mentorReview.operationScore ?? 'Pending'} / 2</p></div>
              <div><p className="text-xs text-slate-500">Total points</p><p className="mt-1 text-xl font-bold text-indigo-700">{mentorReview.totalScore ?? 'Pending'} / 5</p></div>
            </div>
          ) : <p className="text-sm text-slate-500">No review has been submitted for this month yet.</p>}
        </CardContent>
      </Card>

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
          title="Previous Month Net Pay"
          value={latestPayslip ? formatCurrency(latestPayslip.netPayable, latestPayslip.currency) : formatCurrency(0)}
          icon={<DollarSign className="w-5 h-5" />}
          color="emerald"
          subtitle={latestPayslip ? latestPayslip.periodName : 'No finalized payroll yet'}
        />
      </div>

      {/* Main Split: Schedule & Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Classes / Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="My Teaching Schedule"
            subtitle="Upcoming instructional sessions requiring student attendance verification"
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {upcomingClasses.length === 0 ? (
                <div className="p-10 text-center text-slate-500">
                  You have no pending classes scheduled this week.
                </div>
              ) : (
                upcomingClasses.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedEvent(cls)}
                    className="p-4 hover:bg-slate-50/70 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors">
                        {cls.title}
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        {formatDate(cls.startTime)} at {formatTime(cls.startTime)} ({cls.durationMinutes} mins) • {cls.branchName}
                      </p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Students: {cls.students.map((s) => s.studentName).join(', ') || 'Roster pending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="text-xs">
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
              title="Applied Deductions & Adjustments"
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
              title="Official Payslip Archive"
              subtitle="Certified payment receipts"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Raise Deduction Dispute</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Provide your explanation or supporting evidence. An administrator will review your statement prior to final payroll lock.
            </p>
            <textarea
              rows={3}
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
              placeholder="State your reasons or details for dispute..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-1">
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
