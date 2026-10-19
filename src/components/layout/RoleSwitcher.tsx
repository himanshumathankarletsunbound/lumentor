'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { UserCheck, ChevronDown, Shield, Briefcase, GraduationCap } from 'lucide-react';
import { Badge } from '../ui/Badge';

export function RoleSwitcher() {
  const { currentUser, switchUser, availableUsers } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMINISTRATOR':
        return <Shield className="w-3.5 h-3.5 text-indigo-600" />;
      case 'OPERATIONS':
        return <Briefcase className="w-3.5 h-3.5 text-amber-600" />;
      case 'MENTOR':
        return <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <UserCheck className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMINISTRATOR':
        return 'default';
      case 'OPERATIONS':
        return 'warning';
      case 'MENTOR':
        return 'success';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs text-left"
        title="Switch user role for testing permissions"
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 shrink-0">
          {getRoleIcon(currentUser.role)}
        </div>
        <div className="hidden sm:block text-xs">
          <p className="font-semibold text-slate-800 leading-tight">{currentUser.name}</p>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">{currentUser.role}</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-900">Switch Persona (RBAC Simulation)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Instantly toggle between system roles to verify permissions and scoped views.
            </p>
          </div>

          <div className="py-1">
            {availableUsers.map((user) => {
              const isSelected = user.id === currentUser.id;
              return (
                <button
                  key={user.id}
                  onClick={() => {
                    switchUser(user.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                    isSelected ? 'bg-indigo-50/80 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getRoleIcon(user.role)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-xs truncate">{user.name}</span>
                      <Badge variant={getRoleBadgeVariant(user.role) as any} size="sm">
                        {user.role}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.roleName}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
