'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PenaltyModal } from '../../../components/payroll/PenaltyModal';
import { CalendarEventModal } from '../../../components/calendar/CalendarEventModal';
import { ClassEvent } from '../../../lib/types/models';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { formatDate, formatTime } from '../../../lib/utils/formatters';

export default function ExceptionsPage() {
  const [classes, setClasses] = useState<ClassEvent[]>(db.getClasses());
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);

  const exceptions = classes.filter(
    (c) => c.status === 'CANCELLED' || c.status === 'LATE_CANCELLED' || c.attendanceStatusSummary === 'ALL_ABSENT'
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cancellations & Exceptions</h1>
            <p className="text-xs text-slate-500 mt-1">
              Audit trail of class cancellations, late cancellations, and attendance exceptions.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ShieldAlert className="w-4 h-4 text-rose-600" />}
            onClick={() => setPenaltyModalOpen(true)}
          >
            Submit Incident / Penalty
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Mentor</TableHead>
              <TableHead>Type of Exception</TableHead>
              <TableHead>Cancellation Reason / Note</TableHead>
              <TableHead>Processed By / Date</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exceptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <TableEmptyState
                    title="No exceptions recorded"
                    description="No cancellations or absent sessions found."
                  />
                </TableCell>
              </TableRow>
            ) : (
              exceptions.map((cls) => (
                <TableRow
                  key={cls.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedEvent(cls)}
                >
                  <TableCell className="font-semibold text-slate-900">
                    <p>{cls.title}</p>
                    <p className="text-[11px] text-slate-400 font-normal">{cls.branchName}</p>
                  </TableCell>
                  <TableCell className="font-medium text-slate-800">{cls.mentorName}</TableCell>
                  <TableCell>
                    <Badge
                      variant={cls.status === 'LATE_CANCELLED' ? 'danger' : 'neutral'}
                      size="sm"
                      dot
                    >
                      {cls.status === 'LATE_CANCELLED' ? 'Late Cancellation' : 'Standard Cancel'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-xs truncate">
                    {cls.cancellationReason || 'No reason recorded'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {cls.cancelledBy ? `${cls.cancelledBy} on ${formatDate(cls.cancelledAt)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <PenaltyModal
          isOpen={penaltyModalOpen}
          onClose={() => setPenaltyModalOpen(false)}
          onSaved={() => {}}
        />

        <CalendarEventModal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          classEvent={selectedEvent}
          onSave={(updated) => {
            db.updateClass(updated.id, updated);
            setClasses(db.getClasses());
            setSelectedEvent(null);
          }}
        />
      </div>
    </AppShell>
  );
}
