'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../lib/auth/AuthContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white shadow-lg shadow-indigo-600/25">
            LU
          </div>
          <p className="mt-4 text-sm font-medium text-slate-300">Checking your workspace session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen flex bg-dashboard-canvas text-slate-900 antialiased overflow-hidden">
      {/* Persistent Left Sidebar with its own independent scroll */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area with its own independent vertical scroll */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-y-auto overscroll-contain">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
