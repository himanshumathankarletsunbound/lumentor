'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PayoutScheduleModal } from '../../../components/payroll/PayoutScheduleModal';
import { PayoutSchedule } from '../../../lib/types/payroll';
import { Mentor } from '../../../lib/types/models';
import { useAuth } from '../../../lib/auth/AuthContext';
import { formatDate } from '../../../lib/utils/formatters';
import Link from 'next/link';
import {
  CalendarClock,
  Plus,
  Play,
  Snowflake,
  ShieldCheck,
  Edit2,
  Trash2,
  Users,
  Search,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Calculator,
} from 'lucide-react';

export default function PayoutSchedulesPage() {
  const { isAdmin } = useAuth();
  const [schedules, setSchedules] = useState<PayoutSchedule[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PayoutSchedule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [schedRes, mentorRes] = await Promise.all([
        fetch('/api/payroll/payout-schedules'),
        fetch('/api/mentors'),
      ]);

      const schedData = await schedRes.json();
      const mentorData = await mentorRes.json();

      if (schedData.success) {
        setSchedules(schedData.schedules || []);
      }
      if (mentorData.success) {
        setMentors(mentorData.mentors || []);
      }
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load payout schedules.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateNew = () => {
    setEditingSchedule(null);
    setModalOpen(true);
  };

  const handleEdit = (schedule: PayoutSchedule) => {
    setEditingSchedule(schedule);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete payout schedule "${name}"?`)) return;

    try {
      const res = await fetch(`/api/payroll/payout-schedules?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete schedule');

      setNotification({ type: 'success', message: `Schedule "${name}" deleted successfully.` });
      await loadData();
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error deleting schedule',
      });
    }
  };

  const handleToggleFreeze = async (schedule: PayoutSchedule) => {
    const isCurrentlyFrozen = schedule.isFrozen;
    const action = isCurrentlyFrozen ? 'UNFREEZE' : 'FREEZE';

    if (
      !confirm(
        isCurrentlyFrozen
          ? `Unfreeze schedule "${schedule.name}"? Classes in this cycle will be editable again.`
          : `Freeze schedule "${schedule.name}"? This locks all classes and attendance records in this cycle from retroactive modifications.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/payroll/payout-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: schedule.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update freeze status');

      setNotification({
        type: 'success',
        message: isCurrentlyFrozen
          ? `Schedule "${schedule.name}" has been unlocked.`
          : `Schedule "${schedule.name}" is now FROZEN. Past records are secured.`,
      });
      await loadData();
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to toggle freeze',
      });
    }
  };

  const handleScaffoldStandardSchedules = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed current month
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      const prevMonthStr = String(month === 0 ? 12 : month).padStart(2, '0');
      const prevYearStr = String(month === 0 ? year - 1 : year);
      const currMonthStr = String(month + 1).padStart(2, '0');

      const standards = [
        {
          name: `${year} - 3rd of Month Payout Cohort`,
          code: `SCHED-03-${year}${currMonthStr}`,
          startDate: `${prevYearStr}-${prevMonthStr}-01`,
          endDate: `${prevYearStr}-${prevMonthStr}-${String(prevMonthLastDay).padStart(2, '0')}`,
          freezingDate: `${prevYearStr}-${prevMonthStr}-${String(prevMonthLastDay).padStart(2, '0')}`,
          payoutDate: `${year}-${currMonthStr}-03`,
          payoutDay: 3,
          description: 'Standard monthly cohort for mentors disbursed on the 3rd of each month.',
        },
        {
          name: `${year} - 5th of Month Payout Cohort`,
          code: `SCHED-05-${year}${currMonthStr}`,
          startDate: `${prevYearStr}-${prevMonthStr}-01`,
          endDate: `${prevYearStr}-${prevMonthStr}-${String(prevMonthLastDay).padStart(2, '0')}`,
          freezingDate: `${prevYearStr}-${prevMonthStr}-${String(prevMonthLastDay).padStart(2, '0')}`,
          payoutDate: `${year}-${currMonthStr}-05`,
          payoutDay: 5,
          description: 'Monthly cohort for mentors disbursed on the 5th of each month.',
        },
        {
          name: `${year} - 15th Mid-Month Payout Cohort`,
          code: `SCHED-15-${year}${currMonthStr}`,
          startDate: `${year}-${currMonthStr}-01`,
          endDate: `${year}-${currMonthStr}-15`,
          freezingDate: `${year}-${currMonthStr}-15`,
          payoutDate: `${year}-${currMonthStr}-15`,
          payoutDay: 15,
          description: 'Mid-month cohort for mentors disbursed on the 15th of each month.',
        },
      ];

      for (const item of standards) {
        await fetch('/api/payroll/payout-schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      }

      setNotification({
        type: 'success',
        message: 'Successfully generated standard 3rd, 5th, and 15th payout schedules!',
      });
      await loadData();
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to generate standard schedules',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = schedules.filter((s) => {
    if (filterDay !== 'ALL' && s.payoutDay !== Number(filterDay)) return false;
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'FROZEN' && !s.isFrozen) return false;
      if (filterStatus !== 'FROZEN' && s.status !== filterStatus) return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchCode = s.code.toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  const totalAssignedMentors = new Set(
    schedules.flatMap((s) => s.assignedMentorIds || [])
  ).size;

  const nextPayoutSchedule = [...schedules]
    .filter((s) => new Date(s.payoutDate) >= new Date())
    .sort((a, b) => new Date(a.payoutDate).getTime() - new Date(b.payoutDate).getTime())[0];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Sub-nav Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Link
            href="/finance/payout-schedules"
            className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-200 shadow-2xs flex items-center gap-1.5"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Payout Schedules (3rd, 5th, 15th)
          </Link>
          <Link
            href="/finance/payroll-processing"
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          >
            <Calculator className="w-3.5 h-3.5" />
            Process Payroll Batch
          </Link>
          <Link
            href="/finance/single-payout"
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-100 transition-colors"
          >
            Single Payout
          </Link>
          <Link
            href="/finance/payroll-rules"
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-100 transition-colors"
          >
            Payroll Rules & Plans
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                <CalendarClock className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Payout Schedules & Freeze Windows
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Configure multiple recurring payout cohorts (<strong>3rd</strong>, <strong>5th</strong>, and <strong>15th</strong> of each month), set session boundary windows, manage month-end freezing cutoff dates, and disburse on time.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {schedules.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Sparkles className="w-4 h-4 text-indigo-600" />}
                onClick={handleScaffoldStandardSchedules}
                isLoading={isLoading}
              >
                Generate Standard 3rd/5th/15th
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleCreateNew}
            >
              New Payout Schedule
            </Button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* KPI Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-indigo-50/50 to-white">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Schedules
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{schedules.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Defined disbursement cohorts</p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-emerald-50/50 to-white">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Active Schedules
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">
              {schedules.filter((s) => s.status === 'ACTIVE').length}
            </p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Open for batch calculation</p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-sky-50/50 to-white">
            <p className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider">
              Assigned Mentors
            </p>
            <p className="text-2xl font-extrabold text-sky-700 mt-1">{totalAssignedMentors}</p>
            <p className="text-[11px] text-sky-600 mt-0.5">Mapped to payout schedules</p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-50/50 to-white">
            <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
              Next Payout Release
            </p>
            <p className="text-lg font-bold text-purple-900 mt-1 truncate">
              {nextPayoutSchedule
                ? `${formatDate(nextPayoutSchedule.payoutDate)} (Day ${nextPayoutSchedule.payoutDay})`
                : 'None scheduled'}
            </p>
            <p className="text-[11px] text-purple-600 mt-0.5 truncate">
              {nextPayoutSchedule?.name || 'All cycles completed'}
            </p>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search schedules by title or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold">Payout Day:</span>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              >
                <option value="ALL">All Cohorts</option>
                <option value="3">3rd of Month</option>
                <option value="5">5th of Month</option>
                <option value="15">15th of Month</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="UPCOMING">UPCOMING</option>
                <option value="CLOSED">CLOSED</option>
                <option value="FROZEN">FROZEN ONLY</option>
              </select>
            </div>
          </div>
        </div>

        {/* Schedules Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schedule / Cohort</TableHead>
                <TableHead>Payout Day</TableHead>
                <TableHead>Session Range (Start → End)</TableHead>
                <TableHead>Freezing Cutoff Date</TableHead>
                <TableHead>Date of Payout</TableHead>
                <TableHead>Assigned Mentors</TableHead>
                <TableHead>Status & Lock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <TableEmptyState
                      title="No payout schedules configured"
                      description="Create your first payout schedule or click 'Generate Standard 3rd/5th/15th' to auto-populate standard cycles."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => {
                  const assignedCount = s.assignedMentorIds?.length || 0;
                  const isFrozen = Boolean(s.isFrozen);

                  return (
                    <TableRow key={s.id} className="hover:bg-slate-50/70">
                      <TableCell className="font-semibold text-slate-900">
                        <div>
                          <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            {s.name}
                            {isFrozen && (
                              <span title="Frozen cycle - attendance locked">
                                <Snowflake className="w-3.5 h-3.5 text-sky-600 inline" />
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">{s.code}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            s.payoutDay === 3
                              ? 'purple'
                              : s.payoutDay === 5
                              ? 'info'
                              : s.payoutDay === 15
                              ? 'success'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {s.payoutDay}th of Month
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-slate-700">
                        <div className="flex items-center gap-1 font-medium">
                          <span>{formatDate(s.startDate)}</span>
                          <span className="text-slate-400">→</span>
                          <span>{formatDate(s.endDate)}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <Snowflake
                            className={`w-3.5 h-3.5 ${
                              isFrozen ? 'text-sky-600' : 'text-slate-400'
                            }`}
                          />
                          <span
                            className={
                              isFrozen
                                ? 'font-bold text-sky-800'
                                : 'text-slate-700'
                            }
                          >
                            {formatDate(s.freezingDate)}
                          </span>
                        </div>
                        {isFrozen && (
                          <span className="text-[10px] text-sky-600 block mt-0.5">
                            Locked by {s.frozenBy || 'Admin'}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{formatDate(s.payoutDate)}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1 text-slate-700">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold">{assignedCount}</span>
                          <span className="text-slate-400">
                            mentor{assignedCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant={
                              s.status === 'ACTIVE'
                                ? 'success'
                                : s.status === 'UPCOMING'
                                ? 'info'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {s.status}
                          </Badge>
                          {isFrozen && (
                            <Badge variant="warning" size="sm">
                              FROZEN
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/finance/payroll-processing?scheduleId=${s.id}`}
                            title="Calculate Payroll Batch for this schedule"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                              leftIcon={<Play className="w-3 h-3 text-indigo-600" />}
                            >
                              Run Batch
                            </Button>
                          </Link>

                          <Button
                            variant="ghost"
                            size="sm"
                            title={isFrozen ? 'Unfreeze Schedule' : 'Freeze Schedule'}
                            onClick={() => handleToggleFreeze(s)}
                            className={isFrozen ? 'text-sky-700' : 'text-slate-500'}
                          >
                            {isFrozen ? (
                              <Unlock className="w-3.5 h-3.5" />
                            ) : (
                              <Lock className="w-3.5 h-3.5" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit Schedule"
                            onClick={() => handleEdit(s)}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete Schedule"
                            onClick={() => handleDelete(s.id, s.name)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Modal */}
        <PayoutScheduleModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          scheduleToEdit={editingSchedule}
          onSaved={loadData}
          mentors={mentors}
        />
      </div>
    </AppShell>
  );
}
