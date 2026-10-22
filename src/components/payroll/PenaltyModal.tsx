'use client';

import React, { useEffect, useState } from 'react';
import { Penalty, PenaltyCategory, PenaltyPolicy } from '../../lib/types/payroll';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { useAuth } from '../../lib/auth/AuthContext';
import { db } from '../../lib/db/store';
import { ShieldAlert, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/utils/formatters';

export interface PenaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  penaltyToView?: Penalty | null;
  onSaved: () => void;
  initialMentorId?: string;
}

export function PenaltyModal({
  isOpen,
  onClose,
  penaltyToView,
  onSaved,
  initialMentorId,
}: PenaltyModalProps) {
  const { currentUser, isAdmin, isMentor } = useAuth();
  const mentors = db.getMentors();
  const branches = db.getBranches();
  const initialMentor = mentors.find((mentor) => mentor.id === initialMentorId) || mentors[0];

  // Form State for new penalty
  const [mentorId, setMentorId] = useState(initialMentor?.id || '');
  const [branchId, setBranchId] = useState(initialMentor?.branchId || branches[0]?.id || '');
  const [category, setCategory] = useState<PenaltyCategory>('LATE_CANCELLATION');
  const [amount, setAmount] = useState('35.00');
  const [reason, setReason] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  // Workflow states
  const [rejectionReason, setRejectionReason] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showReverseInput, setShowReverseInput] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [policies, setPolicies] = useState<PenaltyPolicy[]>([]);
  const isViewing = Boolean(penaltyToView);

  useEffect(() => {
    if (!isOpen || isViewing) return;
    void fetch('/api/penalty-policies')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load penalty policies.');
        setPolicies(result.policies);
        if (result.policies[0]) {
          setCategory(result.policies[0].name);
          setAmount(String(result.policies[0].defaultAmount || 0));
        }
      })
      .catch((error: unknown) => setErrorMsg(error instanceof Error ? error.message : 'Unable to load penalty policies.'));
  }, [isOpen, isViewing]);

  const handleSubmitNew = async () => {
    if (!reason.trim()) {
      setErrorMsg('Mandatory reason is required to submit a penalty.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid monetary amount.');
      return;
    }

    const response = await fetch('/api/penalties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId, branchId, category, reason, amount: parsedAmount, evidenceNote, evidenceUrl, createdBy: currentUser.id, createdByName: currentUser.name }),
    });
    const result = await response.json();
    if (!response.ok) {
      setErrorMsg(result.error || 'Unable to submit penalty.');
      return;
    }
    const pen = result;

    db.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'PENALTY_SUBMITTED',
      entityType: 'Penalty',
      entityId: pen.id,
      details: `Submitted ₹${parsedAmount} penalty for ${pen.mentorName} (${category}): ${reason}`,
    });

    onSaved();
    onClose();
  };

  const handleApprove = () => {
    if (!penaltyToView) return;
    try {
      db.approvePenalty(penaltyToView.id, currentUser.id, currentUser.name);
      db.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'PENALTY_APPROVED',
        entityType: 'Penalty',
        entityId: penaltyToView.id,
        details: `Approved penalty ${penaltyToView.id} of ₹${penaltyToView.amount} for ${penaltyToView.mentorName}`,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReject = () => {
    if (!penaltyToView || !rejectionReason.trim()) return;
    try {
      db.rejectPenalty(penaltyToView.id, currentUser.id, currentUser.name, rejectionReason);
      db.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'PENALTY_REJECTED',
        entityType: 'Penalty',
        entityId: penaltyToView.id,
        details: `Rejected penalty ${penaltyToView.id}: ${rejectionReason}`,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReverse = () => {
    if (!penaltyToView || !reversalReason.trim()) return;
    try {
      db.reversePenalty(penaltyToView.id, currentUser.id, currentUser.name, reversalReason);
      db.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'PENALTY_REVERSED',
        entityType: 'Penalty',
        entityId: penaltyToView.id,
        details: `Reversed penalty ${penaltyToView.id}: ${reversalReason}`,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDispute = () => {
    if (!penaltyToView || !disputeNote.trim()) return;
    db.disputePenalty(penaltyToView.id, disputeNote);
    db.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'PENALTY_DISPUTED',
      entityType: 'Penalty',
      entityId: penaltyToView.id,
      details: `Mentor raised dispute on penalty ${penaltyToView.id}: ${disputeNote}`,
    });
    onSaved();
    onClose();
  };

  // Anti-self-approval rule check
  const isSubmitter = Boolean(penaltyToView && penaltyToView.createdBy === currentUser.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={isViewing ? 'Penalty Details & Authorization' : 'Record Operational Penalty'}
      subtitle={
        isViewing
          ? `Record ID: ${penaltyToView?.id}`
          : 'Submit operational violation or deduction for administrative approval'
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>

          {!isViewing ? (
            <Button variant="primary" size="sm" onClick={handleSubmitNew}>
              Submit Penalty for Review
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {/* Mentor Dispute Action */}
              {isMentor && penaltyToView?.disputeStatus !== 'DISPUTED' && !showDisputeInput && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-700 border-amber-300"
                  onClick={() => setShowDisputeInput(true)}
                >
                  Raise Dispute / Correction
                </Button>
              )}

              {/* Admin Actions */}
              {isAdmin && penaltyToView?.status === 'SUBMITTED' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 border-rose-300 hover:bg-rose-50"
                    onClick={() => setShowRejectInput(!showRejectInput)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    disabled={isSubmitter}
                    onClick={handleApprove}
                    title={isSubmitter ? 'Anti-self-approval rule: submitter cannot approve own penalty' : ''}
                  >
                    Approve Penalty
                  </Button>
                </>
              )}

              {/* Admin Reversal */}
              {isAdmin && (penaltyToView?.status === 'APPROVED' || penaltyToView?.status === 'APPLIED') && !showReverseInput && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-600 hover:bg-slate-100"
                  onClick={() => setShowReverseInput(true)}
                >
                  Reverse Penalty
                </Button>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {errorMsg && (
          <Alert type="error" title="Action Prohibited" message={errorMsg} />
        )}

        {/* --- VIEW MODE --- */}
        {isViewing && penaltyToView && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Mentor</p>
                  <p className="font-bold text-slate-900 text-sm">{penaltyToView.mentorName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Amount</p>
                  <p className="font-extrabold text-rose-600 text-lg">
                    {formatCurrency(penaltyToView.amount)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <p className="text-slate-400 font-medium">Category</p>
                  <p className="font-semibold text-slate-800">{penaltyToView.category.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Approval Status</p>
                  <Badge
                    variant={
                      penaltyToView.status === 'APPROVED' || penaltyToView.status === 'APPLIED'
                        ? 'success'
                        : penaltyToView.status === 'SUBMITTED'
                        ? 'warning'
                        : penaltyToView.status === 'REVERSED'
                        ? 'purple'
                        : 'danger'
                    }
                    size="sm"
                    dot
                  >
                    {penaltyToView.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Mandatory Reason */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Reason for Penalty:</label>
              <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs leading-relaxed">
                {penaltyToView.reason}
              </div>
            </div>

            {/* Supporting Evidence */}
            {penaltyToView.evidenceNote && (
              <div>
                <label className="font-bold text-slate-700 block mb-1">Supporting Evidence / Notes:</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs">
                  {penaltyToView.evidenceNote}
                </div>
              </div>
            )}

            {/* Submitter & Approver Audit Info */}
            <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200 text-slate-500 space-y-1">
              <p>Submitted by: <strong>{penaltyToView.createdByName}</strong> on {formatDateTime(penaltyToView.createdAt)}</p>
              {penaltyToView.approvedByName && (
                <p>Approved by: <strong>{penaltyToView.approvedByName}</strong> on {formatDateTime(penaltyToView.approvedAt)}</p>
              )}
              {penaltyToView.reversedByName && (
                <p className="text-purple-700">Reversed by: <strong>{penaltyToView.reversedByName}</strong> ({penaltyToView.reversalReason})</p>
              )}
            </div>

            {/* Anti-self-approval Alert */}
            {isSubmitter && penaltyToView.status === 'SUBMITTED' && (
              <Alert
                type="warning"
                title="Anti-Self-Approval Enforcement"
                message="You originally submitted this penalty. System policy prohibits approving your own penalties. An independent administrator must review and approve it."
              />
            )}

            {/* Rejection Input */}
            {showRejectInput && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <label className="font-semibold text-rose-900 block">Mandatory Rejection Reason:</label>
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this penalty is rejected..."
                  className="w-full p-2 bg-white border border-rose-300 rounded-lg text-xs focus:ring-1 focus:ring-rose-500"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowRejectInput(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleReject} disabled={!rejectionReason.trim()}>
                    Confirm Rejection
                  </Button>
                </div>
              </div>
            )}

            {/* Reversal Input */}
            {showReverseInput && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                <label className="font-semibold text-purple-900 block">Authorized Reversal Rationale:</label>
                <textarea
                  rows={2}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Explain why this approved penalty is being reversed..."
                  className="w-full p-2 bg-white border border-purple-300 rounded-lg text-xs focus:ring-1 focus:ring-purple-500"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowReverseInput(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleReverse} disabled={!reversalReason.trim()}>
                    Confirm Reversal
                  </Button>
                </div>
              </div>
            )}

            {/* Mentor Dispute Input */}
            {showDisputeInput && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <label className="font-semibold text-amber-900 block">Mentor Dispute Statement:</label>
                <textarea
                  rows={2}
                  value={disputeNote}
                  onChange={(e) => setDisputeNote(e.target.value)}
                  placeholder="Provide clarification or evidence for management review..."
                  className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowDisputeInput(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleDispute} disabled={!disputeNote.trim()}>
                    Submit Dispute
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- CREATE MODE --- */}
        {!isViewing && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Mentor *</label>
                <select
                  value={mentorId}
                  onChange={(e) => setMentorId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                >
                  {mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.branchName || 'Campus'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Branch Location *</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Violation Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PenaltyCategory)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                >
                  {policies.length === 0 ? (
                    <option value="">No active penalty policies configured</option>
                  ) : policies.map((policy) => (
                    <option key={policy.id} value={policy.name}>{policy.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Penalty Amount (₹ INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Mandatory Incident Reason *</label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State specific policy violation, class ID, or timing details..."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Supporting Evidence / Verification Note</label>
              <textarea
                rows={2}
                value={evidenceNote}
                onChange={(e) => setEvidenceNote(e.target.value)}
                placeholder="e.g. Reception logs timestamped at 15:20; parent confirmation attached..."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
