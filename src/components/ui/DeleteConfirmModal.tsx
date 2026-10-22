'use client';

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title?: string;
  recordName: string;
  recordType?: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  title = 'Confirm Deletion',
  recordName,
  recordType = 'record',
  isDeleting = false,
  onConfirm,
  onClose,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={isDeleting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={isDeleting}
            onClick={onConfirm}
          >
            Delete {recordType}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3 py-1">
        <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-900 text-sm">
            Are you sure you want to delete <span className="text-rose-700 font-bold">"{recordName}"</span>?
          </p>
          <p>
            This action will permanently remove this {recordType} from the database. Any historical class logs linked to this {recordType} will retain historical snapshots.
          </p>
        </div>
      </div>
    </Modal>
  );
}
