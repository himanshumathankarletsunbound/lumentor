'use client';

import React, { useEffect, useState } from 'react';
import { Menu, Building2, Bell, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import { RoleSwitcher } from './RoleSwitcher';
import Link from 'next/link';
import type { Branch } from '../../lib/types/models';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { selectedBranch, setSelectedBranch, isMentor, currentUser, logout } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/records?type=branch')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { records?: Branch[] } | null) => {
        if (active && payload?.records) setBranches(payload.records);
      })
      .catch(() => {
        // The branch filter remains usable with its global option when the API is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Branch Selector (Hidden for Mentor role) */}
        {!isMentor && (
          <div className="hidden sm:flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              aria-label="Filter by Branch"
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Campus Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Quick Classcard Sync button */}
        <Link
          href="/admin/classcard-integration"
          className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Classcard Sync</span>
        </Link>

        {/* Notification Bell */}
        <button
          className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 relative transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* User Badge / Profile */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-800 leading-tight">{currentUser.name}</p>
            <p className="text-[10px] text-slate-500 truncate max-w-[140px]">{currentUser.email}</p>
          </div>
        </div>

        {/* Role Switcher Pill */}
        <RoleSwitcher />

        {/* Sign Out Button */}
        <button
          onClick={() => logout()}
          title="Sign out"
          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
