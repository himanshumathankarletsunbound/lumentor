'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, ChevronDown, MoreHorizontal, ExternalLink, Copy, FileDown, Sparkles } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  extraActions?: ActionMenuItem[];
  editTooltip?: string;
  deleteTooltip?: string;
  moreTooltip?: string;
}

export function RowActions({
  onEdit,
  onDelete,
  extraActions,
  editTooltip = 'Edit record',
  deleteTooltip = 'Delete record',
  moreTooltip = 'More actions',
}: RowActionsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or ESC key
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const defaultExtraActions: ActionMenuItem[] = [
    {
      label: 'View detailed audit',
      icon: <ExternalLink className="w-3.5 h-3.5 text-slate-400" />,
      onClick: () => {
        alert('Detailed record audit trail will be available in the upcoming release.');
      },
    },
    {
      label: 'Duplicate record',
      icon: <Copy className="w-3.5 h-3.5 text-slate-400" />,
      onClick: () => {
        alert('Record duplication workflow will be activated soon.');
      },
    },
    {
      label: 'Export snapshot',
      icon: <FileDown className="w-3.5 h-3.5 text-slate-400" />,
      onClick: () => {
        alert('Direct single-record export is slated for next sprint.');
      },
    },
  ];

  const actionsList = extraActions && extraActions.length > 0 ? extraActions : defaultExtraActions;

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Pen: Edit */}
      <button
        type="button"
        onClick={onEdit}
        title={editTooltip}
        aria-label={editTooltip}
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {/* Dustbin: Delete */}
      <button
        type="button"
        onClick={onDelete}
        title={deleteTooltip}
        aria-label={deleteTooltip}
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Dropdown Arrow: Future Actions */}
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title={moreTooltip}
          aria-label={moreTooltip}
          aria-expanded={dropdownOpen}
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
            dropdownOpen ? 'bg-slate-100 text-slate-900 border-slate-200' : 'border-transparent'
          }`}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 z-50 mt-1 w-52 origin-top-right rounded-xl bg-white p-1 text-xs shadow-xl ring-1 ring-slate-900/10 border border-slate-100 focus:outline-none animate-in fade-in-50 zoom-in-95 duration-100">
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              Future Operations
            </div>
            <div className="py-1">
              {actionsList.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={action.disabled}
                  onClick={() => {
                    setDropdownOpen(false);
                    action.onClick?.();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-1 pt-1 border-t border-slate-100 px-2.5 py-1.5 bg-slate-50/70 rounded-b-lg flex items-center gap-1.5 text-[10px] text-slate-500">
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              <span>More workflows in development</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
