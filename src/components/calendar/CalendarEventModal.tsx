'use client';

import React, { useState } from 'react';
import { ClassEvent, AttendanceStatus, ClassStatus } from '../../lib/types/models';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  Calendar,
  Clock,
  MapPin,
  GraduationCap,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Link as LinkIcon,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { formatDateTime } from '../../lib/utils/formatters';

export interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  classEvent: ClassEvent | null;
  onSave: (updatedEvent: ClassEvent) => void;
}

export function CalendarEventModal({
  isOpen,
  onClose,
  classEvent,
  onSave,
}: CalendarEventModalProps) {
  const { currentUser, hasPermission, isMentor } = useAuth();
  const [eventData, setEventData] = useState<ClassEvent | null>(classEvent);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showCancellationForm, setShowCancellationForm] = useState(false);
  const [isLateCancel, setIsLateCancel] = useState(false);

  // Sync state if classEvent changes
  React.useEffect(() => {
    setEventData(classEvent);
    setShowCancellationForm(false);
  }, [classEvent]);

  if (!eventData) return null;

  const canEditAttendance =
    hasPermission('attendance', 'edit') ||
    (isMentor && currentUser.mentorId === eventData.mentorId);

  const canManageExceptions = hasPermission('exceptions', 'edit');

  const handleAttendanceChange = (
    studentId: string,
    newStatus: AttendanceStatus,
    notes?: string
  ) => {
    if (!canEditAttendance) return;
    const updatedRoster = eventData.students.map((s) => {
      if (s.studentId === studentId) {
        return {
          ...s,
          attendanceStatus: newStatus,
          markedAt: new Date().toISOString(),
          markedBy: currentUser.name,
          notes: notes !== undefined ? notes : s.notes,
        };
      }
      return s;
    });

    // Compute summary
    const statuses = updatedRoster.map((s) => s.attendanceStatus);
    let summary: 'ALL_PRESENT' | 'PARTIAL' | 'ALL_ABSENT' | 'UNMARKED' = 'PARTIAL';
    if (statuses.every((s) => s === 'PRESENT' || s === 'LATE')) summary = 'ALL_PRESENT';
    else if (statuses.every((s) => s === 'ABSENT' || s === 'ABSENT_BILLABLE')) summary = 'ALL_ABSENT';
    else if (statuses.every((s) => s === 'UNMARKED')) summary = 'UNMARKED';

    let updatedStatus = eventData.status;
    if (eventData.status === 'SCHEDULED' && !statuses.includes('UNMARKED')) {
      updatedStatus = 'COMPLETED';
    }

    setEventData({
      ...eventData,
      students: updatedRoster,
      attendanceStatusSummary: summary,
      status: updatedStatus,
    });
  };

  const handleConfirmCancellation = () => {
    if (!cancellationReason.trim()) return;
    const newStatus: ClassStatus = isLateCancel ? 'LATE_CANCELLED' : 'CANCELLED';
    const updated: ClassEvent = {
      ...eventData,
      status: newStatus,
      isLateCancellation: isLateCancel,
      cancellationReason,
      cancelledAt: new Date().toISOString(),
      cancelledBy: currentUser.name,
      attendanceStatusSummary: 'ALL_ABSENT',
      students: eventData.students.map((s) => ({
        ...s,
        attendanceStatus: 'ABSENT',
      })),
    };
    setEventData(updated);
    setShowCancellationForm(false);
    onSave(updated);
  };

  const handleSave = () => {
    if (eventData) {
      onSave(eventData);
      onClose();
    }
  };

  const getStatusBadge = (status: ClassStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success" dot>Completed</Badge>;
      case 'SCHEDULED':
        return <Badge variant="info" dot>Scheduled</Badge>;
      case 'LATE_CANCELLED':
        return <Badge variant="danger" dot>Late Cancelled</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral" dot>Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-bold text-slate-900">{eventData.title}</span>
          {getStatusBadge(eventData.status)}
          {eventData.provenance === 'CLASSCARD_SOURCED' && (
            <Badge variant="purple" size="sm">Classcard Synced</Badge>
          )}
        </div>
      }
      subtitle={`Session ID: ${eventData.id} ${eventData.externalId ? `(Classcard: ${eventData.externalId})` : ''}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {canManageExceptions && eventData.status === 'SCHEDULED' && !showCancellationForm && (
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => setShowCancellationForm(true)}
              >
                Report Cancellation / Late Cancel
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save className="w-4 h-4" />}
              onClick={handleSave}
            >
              Save Class Changes
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-sm">
        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Date & Time</p>
              <p>{formatDateTime(eventData.startTime)} ({eventData.durationMinutes} mins)</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Assigned Mentor</p>
              <p>{eventData.mentorName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Branch & Location</p>
              <p>{eventData.branchName} {eventData.room ? `• ${eventData.room}` : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Subject / Package</p>
              <p>{eventData.subjectName} {eventData.packageName ? `(${eventData.packageName})` : ''}</p>
            </div>
          </div>
        </div>

        {/* Cancellation Notice if already cancelled */}
        {(eventData.status === 'CANCELLED' || eventData.status === 'LATE_CANCELLED') && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>
                {eventData.isLateCancellation ? 'Late Cancellation Notice' : 'Standard Cancellation'}
              </span>
            </div>
            <p><strong>Reason:</strong> {eventData.cancellationReason || 'No reason specified'}</p>
            {eventData.cancelledBy && (
              <p className="text-[11px] text-rose-700 mt-0.5">
                Processed by {eventData.cancelledBy} on {formatDateTime(eventData.cancelledAt)}
              </p>
            )}
          </div>
        )}

        {/* Inline Cancellation Form */}
        {showCancellationForm && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Record Class Cancellation</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-amber-900 block">
                Mandatory Cancellation Reason:
              </label>
              <input
                type="text"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g. Student illness notified 2 hours in advance"
                className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isLateCheck"
                checked={isLateCancel}
                onChange={(e) => setIsLateCancel(e.target.checked)}
                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="isLateCheck" className="text-xs text-amber-900 font-medium cursor-pointer">
                Classify as Late Cancellation (subject to late fee / mentor 50% policy)
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancellationForm(false)}
              >
                Dismiss
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!cancellationReason.trim()}
                onClick={handleConfirmCancellation}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        )}

        {/* Interactive Student Roster & Attendance Marking */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Enrolled Student Roster & Attendance
            </h4>
            <span className="text-xs text-slate-400">
              {eventData.students.length} student{eventData.students.length === 1 ? '' : 's'} enrolled
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
            {eventData.students.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No students enrolled in this session yet.
              </div>
            ) : (
              eventData.students.map((student) => (
                <div key={student.studentId} className="p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800 text-xs sm:text-sm">
                        {student.studentName}
                      </p>
                      <p className="text-[11px] text-slate-400">{student.studentEmail}</p>
                    </div>

                    {/* Attendance Action Buttons */}
                    {canEditAttendance ? (
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                        <button
                          onClick={() => handleAttendanceChange(student.studentId, 'PRESENT')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            student.attendanceStatus === 'PRESENT'
                              ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.studentId, 'LATE')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            student.attendanceStatus === 'LATE'
                              ? 'bg-amber-500 text-white shadow-xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Late
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.studentId, 'ABSENT')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            student.attendanceStatus === 'ABSENT'
                              ? 'bg-rose-600 text-white shadow-xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Absent
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.studentId, 'ABSENT_BILLABLE')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            student.attendanceStatus === 'ABSENT_BILLABLE'
                              ? 'bg-violet-600 text-white shadow-xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Absent Billable
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.studentId, 'EXCUSED')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            student.attendanceStatus === 'EXCUSED'
                              ? 'bg-sky-600 text-white shadow-xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Excused
                        </button>
                      </div>
                    ) : (
                      <Badge
                        variant={
                          student.attendanceStatus === 'PRESENT'
                            ? 'success'
                            : student.attendanceStatus === 'LATE'
                            ? 'warning'
                            : student.attendanceStatus === 'ABSENT'
                            ? 'danger'
                            : student.attendanceStatus === 'ABSENT_BILLABLE'
                            ? 'purple'
                            : 'neutral'
                        }
                      >
                        {student.attendanceStatus === 'ABSENT_BILLABLE' ? 'ABSENT BILLABLE' : student.attendanceStatus}
                      </Badge>
                    )}
                  </div>

                  {/* Attendance Note / Feedback */}
                  {canEditAttendance && (
                    <input
                      type="text"
                      placeholder="Add session notes or progress feedback for student..."
                      value={student.notes || ''}
                      onChange={(e) =>
                        handleAttendanceChange(student.studentId, student.attendanceStatus, e.target.value)
                      }
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  )}
                  {!canEditAttendance && student.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg italic">
                      "{student.notes}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
