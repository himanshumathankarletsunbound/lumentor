'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Menu, Building2, Bell, ChevronDown, LifeBuoy, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import Link from 'next/link';
import type { Branch } from '../../lib/types/models';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { selectedBranch, setSelectedBranch, isMentor, currentUser, logout } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeProfile = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', closeProfile);
    return () => document.removeEventListener('mousedown', closeProfile);
  }, []);

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
        {/* Notification Bell */}
        <button
          className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 relative transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-semibold leading-tight text-slate-800">{currentUser.name}</span>
              <span className="block max-w-[140px] truncate text-[10px] text-slate-500">{currentUser.email}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-2 shadow-xl z-50" role="menu">
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="text-xs font-semibold text-slate-900">{currentUser.name}</p>
                <p className="truncate text-[11px] text-slate-500">{currentUser.email}</p>
              </div>
              <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50" role="menuitem">
                <UserCircle className="h-4 w-4 text-slate-400" /> My profile
              </Link>
              <Link href="/support/tickets" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50" role="menuitem">
                <LifeBuoy className="h-4 w-4 text-slate-400" /> Support ticket
              </Link>
              <button onClick={() => logout()} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-xs text-rose-600 hover:bg-rose-50" role="menuitem">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
