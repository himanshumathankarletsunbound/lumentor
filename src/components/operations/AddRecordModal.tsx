'use client';

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface AddRecordField {
  name: string;
  label: string;
  section?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea';
  options?: { label: string; value: string }[];
  required?: boolean;
  visibleWhen?: (values: Record<string, string>) => boolean;
}

interface AddRecordModalProps {
  title: string;
  fields: AddRecordField[];
  isOpen: boolean;
  onClose: () => void;
  initialValues?: Record<string, string>;
  submitLabel?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  onSave: (values: Record<string, string>) => void | Promise<void>;
}

export function AddRecordModal({
  title,
  fields,
  isOpen,
  onClose,
  initialValues,
  submitLabel,
  maxWidth = 'md',
  onSave,
}: AddRecordModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Form state must reset when the modal opens with a new record.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(initialValues ? { ...initialValues } : {});
      setError(null);
    }
  }, [isOpen, initialValues]);

  const requiredFields = fields.filter((field) => field.required !== false);
  const canSave = requiredFields.every((field) => (values[field.name] ?? '').trim().length > 0);

  const close = () => {
    setValues({});
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={title}
      maxWidth={maxWidth}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSave || saving}
            isLoading={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onSave(values);
                setValues({});
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to save record.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {submitLabel || (initialValues ? 'Save changes' : 'Add record')}
          </Button>
        </div>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field, index) => {
          if (field.visibleWhen && !field.visibleWhen(values)) return null;
          const previousVisibleField = fields.slice(0, index).reverse().find((item) => !item.visibleWhen || item.visibleWhen(values));
          const showSection = field.section && field.section !== previousVisibleField?.section;
          return (
            <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {showSection && (
                <div className="mb-1 mt-2 border-b border-slate-200 pb-2 sm:col-span-2 first:mt-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">{field.section}</p>
                </div>
              )}
              <label className="block text-xs font-semibold text-slate-700">
                {field.label}{field.required !== false ? ' *' : ''}
            {field.type === 'select' ? (
              <select
                required={field.required !== false}
                value={values[field.name] ?? ''}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{field.placeholder || `Select ${field.label}...`}</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                rows={3}
                required={field.required !== false}
                value={values[field.name] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <input
                type={field.type || 'text'}
                required={field.required !== false}
                value={values[field.name] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
              </label>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
