'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table';
import { ClassEvent } from '../../lib/types/models';
import { db } from '../../lib/db/store';
import { formatDate, formatTime } from '../../lib/utils/formatters';
import { CheckCircle2, AlertTriangle, Users, Check, Sparkles } from 'lucide-react';

export interface ReconcileClassesModalProps {
  isOpen: boolean;
  onClose: () => void;
  unmarkedClasses: ClassEvent[];
  onReconciled: () => void;
}

export function ReconcileClassesModal({
  isOpen,
  onClose,
  unmarkedClasses,
  onReconciled,
}: ReconcileClassesModalProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const handleMarkPresent = (cls: ClassEvent) => {
    setUpdatingId(cls.id);
    try {
      const updatedStudents = cls.students.map((s) => ({
        ...s,
        attendanceStatus: 'PRESENT' as const,
        markedAt: new Date().toISOString(),
        markedBy: 'Payroll Pre-Flight Reconcile',
      }));

      db.updateClass(cls.id, {
        students: updatedStudents,
        attendanceStatusSummary: 'ALL_PRESENT',
        status: 'COMPLETED',
      });

      onReconciled();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAllPresent = () => {
    setIsBulkUpdating(true);
    try {
      for (const cls of unmarkedClasses) {
        const updatedStudents = cls.students.map((s) => ({
          ...s,
          attendanceStatus: 'PRESENT' as const,
          markedAt: new Date().toISOString(),
          markedBy: 'Bulk Pre-Flight Reconcile',
        }));

        db.updateClass(cls.id, {
          students: updatedStudents,
          attendanceStatusSummary: 'ALL_PRESENT',
          status: 'COMPLETED',
        });
      }
      onReconciled();
      onClose();
    } finally {
      setIsBulkUpdating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>Reconcile Unmarked Classes</span>
        </div>
      }
      subtitle={`Review and verify attendance for ${unmarkedClasses.length} session(s) before running payroll.`}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleMarkAllPresent}
            isLoading={isBulkUpdating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Mark All ({unmarkedClasses.length}) as Completed & Present
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
          <p className="font-bold">Faculty Compensation Notice:</p>
          <p className="mt-0.5">
            Sessions marked as <strong>UNMARKED</strong> are excluded by compensation rate cards. Verifying student attendance marks these classes as <strong>COMPLETED</strong>, ensuring mentors receive accurate credit.
          </p>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Mentor</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Roster</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unmarkedClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                    All session rosters have been verified!
                  </TableCell>
                </TableRow>
              ) : (
                unmarkedClasses.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-semibold text-slate-900">
                      <p>{cls.title}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{cls.branchName}</p>
                    </TableCell>

                    <TableCell className="font-medium text-slate-800">
                      {cls.mentorName}
                    </TableCell>

                    <TableCell className="text-slate-600">
                      <p>{formatDate(cls.startTime)}</p>
                      <p className="text-[10px] text-slate-400">{formatTime(cls.startTime)} ({cls.durationMinutes}m)</p>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cls.students.length} student{cls.students.length === 1 ? '' : 's'}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={updatingId === cls.id}
                        className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        onClick={() => handleMarkPresent(cls)}
                      >
                        Confirm Present
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Modal>
  );
}
