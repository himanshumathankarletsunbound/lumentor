'use client';

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface AddRecordField {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'number' | 'select' | 'textarea';
  options?: { label: string; value: string }[];
  required?: boolean;
}

interface AddRecordModalProps {
  title: string;
  fields: AddRecordField[];
  isOpen: boolean;
  onClose: () => void;
  initialValues?: Record<string, string>;
  submitLabel?: string;
  onSave: (values: Record<string, string>) => void | Promise<void>;
}

export function AddRecordModal({
  title,
  fields,
  isOpen,
  onClose,
  initialValues,
  submitLabel,
  onSave,
}: AddRecordModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
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
        {fields.map((field) => (
          <label key={field.name} className={`text-xs font-semibold text-slate-700 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
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
        ))}
      </div>
    </Modal>
  );
}
