'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { PayoutSchedule } from '../../lib/types/payroll';
import { Mentor } from '../../lib/types/models';
import { Calendar, Clock, Snowflake, ShieldCheck, Users, Search, Sparkles } from 'lucide-react';

export interface PayoutScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleToEdit?: PayoutSchedule | null;
  onSaved: () => void;
  mentors: Mentor[];
}

export function PayoutScheduleModal({
  isOpen,
  onClose,
  scheduleToEdit,
  onSaved,
  mentors,
}: PayoutScheduleModalProps) {
  const isEditing = Boolean(scheduleToEdit);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [payoutDay, setPayoutDay] = useState<number>(3);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [freezingDate, setFreezingDate] = useState('');
  const [payoutDate, setPayoutDate] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'UPCOMING' | 'CLOSED'>('ACTIVE');
  const [description, setDescription] = useState('');
  const [assignedMentorIds, setAssignedMentorIds] = useState<string[]>([]);
  const [mentorSearch, setMentorSearch] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Default dates calculator
  const applyPreset = (day: number) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed current month

    let start = '';
    let end = '';
    let freeze = '';
    let payout = '';
    let defaultName = '';
    let defaultCode = '';

    if (day === 3 || day === 5) {
      // Evaluates prior month sessions
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      const prevMonthStr = String(month === 0 ? 12 : month).padStart(2, '0');
      const prevYearStr = String(month === 0 ? year - 1 : year);
      const currMonthStr = String(month + 1).padStart(2, '0');

      start = `${prevYearStr}-${prevMonthStr}-01`;
      end = `${prevYearStr}-${prevMonthStr}-${String(prevMonthLastDay).padStart(2, '0')}`;
      freeze = end;
      payout = `${year}-${currMonthStr}-${String(day).padStart(2, '0')}`;
      defaultName = `${day === 3 ? '3rd' : '5th'} of Month Payout Cohort`;
      defaultCode = `SCHED-${day === 3 ? '03' : '05'}-${prevYearStr}${prevMonthStr}`;
    } else if (day === 15) {
      // Mid-month cycle
      const currMonthStr = String(month + 1).padStart(2, '0');
      start = `${year}-${currMonthStr}-01`;
      end = `${year}-${currMonthStr}-15`;
      freeze = `${year}-${currMonthStr}-15`;
      payout = `${year}-${currMonthStr}-15`;
      defaultName = '15th Mid-Month Payout Cohort';
      defaultCode = `SCHED-15-${year}${currMonthStr}`;
    }

    setPayoutDay(day);
    setName(defaultName);
    setCode(defaultCode);
    setStartDate(start);
    setEndDate(end);
    setFreezingDate(freeze);
    setPayoutDate(payout);

    // Auto-select mentors already having this payout day
    const matchingMentors = mentors.filter((m) => m.payoutDay === day).map((m) => m.id);
    if (matchingMentors.length > 0) {
      setAssignedMentorIds(matchingMentors);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (scheduleToEdit) {
      setName(scheduleToEdit.name);
      setCode(scheduleToEdit.code);
      setPayoutDay(scheduleToEdit.payoutDay || 3);
      setStartDate(scheduleToEdit.startDate);
      setEndDate(scheduleToEdit.endDate);
      setFreezingDate(scheduleToEdit.freezingDate || scheduleToEdit.endDate);
      setPayoutDate(scheduleToEdit.payoutDate);
      setStatus(scheduleToEdit.status);
      setDescription(scheduleToEdit.description || '');
      setAssignedMentorIds(scheduleToEdit.assignedMentorIds || []);
    } else {
      // Apply 3rd of month preset by default
      applyPreset(3);
    }
    setErrorMsg('');
  }, [isOpen, scheduleToEdit]);

  const toggleMentor = (mentorId: string) => {
    setAssignedMentorIds((prev) =>
      prev.includes(mentorId) ? prev.filter((id) => id !== mentorId) : [...prev, mentorId]
    );
  };

  const selectAllMentors = () => {
    setAssignedMentorIds(mentors.map((m) => m.id));
  };

  const clearAllMentors = () => {
    setAssignedMentorIds([]);
  };

  const filteredMentors = mentors.filter(
    (m) =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(mentorSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(mentorSearch.toLowerCase()) ||
      (m.branchName && m.branchName.toLowerCase().includes(mentorSearch.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please specify a schedule name.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Please specify both the starting date and ending date.');
      return;
    }
    if (!freezingDate) {
      setErrorMsg('Please specify a freezing / cutoff date.');
      return;
    }
    if (!payoutDate) {
      setErrorMsg('Please specify the date of payout.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/payroll/payout-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scheduleToEdit?.id,
          name,
          code,
          payoutDay,
          startDate,
          endDate,
          freezingDate,
          payoutDate,
          status,
          description,
          assignedMentorIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save payout schedule');
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <span>{isEditing ? 'Edit Payout Schedule' : 'Configure New Payout Schedule'}</span>
        </div>
      }
      subtitle="Define cycle boundaries, freezing cutoff dates, and disbursement days (e.g. 3rd, 5th, 15th)."
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            {assignedMentorIds.length} mentor{assignedMentorIds.length === 1 ? '' : 's'} assigned
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
              {isEditing ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <Alert variant="danger" title="Validation Error">
            {errorMsg}
          </Alert>
        )}

        {/* Quick Presets Banner */}
        {!isEditing && (
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-indigo-900 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Quick Schedule Presets
              </span>
              <span className="text-[11px] text-indigo-600 font-medium">Click to auto-populate dates</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset(3)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  payoutDay === 3
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <p className="font-bold text-xs">3rd of Month</p>
                <p className={`text-[10px] ${payoutDay === 3 ? 'text-indigo-100' : 'text-slate-400'}`}>
                  Prior month cutoff
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset(5)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  payoutDay === 5
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <p className="font-bold text-xs">5th of Month</p>
                <p className={`text-[10px] ${payoutDay === 5 ? 'text-indigo-100' : 'text-slate-400'}`}>
                  Prior month cutoff
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset(15)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  payoutDay === 15
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <p className="font-bold text-xs">15th Mid-Month</p>
                <p className={`text-[10px] ${payoutDay === 15 ? 'text-indigo-100' : 'text-slate-400'}`}>
                  1st–15th window
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="font-semibold text-slate-700 block mb-1">Schedule Name / Title *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. November 3rd Payout Cohort"
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Code / Identifier</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SCHED-03"
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-indigo-500 outline-none font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Date Boundaries */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Cycle Boundaries, Freezing & Disbursement Dates</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Starting Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:border-indigo-500 outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Classes evaluated on or after this date</p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Ending Date *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:border-indigo-500 outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Classes evaluated on or before this date</p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1 text-sky-800">
                <Snowflake className="w-3 h-3 text-sky-600" /> Freezing Date / Cutoff *
              </label>
              <input
                type="date"
                required
                value={freezingDate}
                onChange={(e) => setFreezingDate(e.target.value)}
                className="w-full p-2 bg-white border border-sky-300 rounded-lg text-slate-900 text-xs focus:border-sky-500 outline-none"
              />
              <p className="text-[10px] text-sky-600 mt-0.5">
                Attendance must be confirmed by this date before month-end lock
              </p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1 text-emerald-800">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Date of Payout *
              </label>
              <input
                type="date"
                required
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full p-2 bg-white border border-emerald-300 rounded-lg text-slate-900 text-xs focus:border-emerald-500 outline-none"
              />
              <p className="text-[10px] text-emerald-600 mt-0.5">
                Scheduled disbursement release to mentors (3rd, 5th, 15th)
              </p>
            </div>
          </div>
        </div>

        {/* Payout Day & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Recurring Payout Day of Month
            </label>
            <div className="flex gap-2">
              {[3, 5, 15].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPayoutDay(d)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    payoutDay === d
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {d}th
                </button>
              ))}
              <div className="flex-1">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={payoutDay}
                  onChange={(e) => setPayoutDay(Number(e.target.value))}
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center font-semibold text-slate-800"
                  placeholder="Custom"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Schedule Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'UPCOMING' | 'CLOSED')}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs"
            >
              <option value="ACTIVE">ACTIVE (Open for processing)</option>
              <option value="UPCOMING">UPCOMING (Scheduled future cycle)</option>
              <option value="CLOSED">CLOSED (Completed & paid)</option>
            </select>
          </div>
        </div>

        {/* Mentors Assignment */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Assigned Mentors ({assignedMentorIds.length}/{mentors.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllMentors}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={clearAllMentors}
                className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="p-2 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
                placeholder="Search mentors by name, email, or campus..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white">
            {filteredMentors.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">No mentors found.</div>
            ) : (
              filteredMentors.map((m) => {
                const isSelected = assignedMentorIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="p-2.5 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMentor(m.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-semibold text-slate-900">
                          {m.firstName} {m.lastName}
                        </p>
                        <p className="text-[10px] text-slate-500">{m.email} • {m.branchName || 'Unassigned Campus'}</p>
                      </div>
                    </div>
                    {m.payoutDay && (
                      <Badge variant="neutral" size="sm">
                        Day {m.payoutDay}
                      </Badge>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Description / Notes */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">Notes / Description (Optional)</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Operational notes regarding this payout cohort or special conditions..."
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:bg-white focus:border-indigo-500 outline-none"
          />
        </div>
      </form>
    </Modal>
  );
}
