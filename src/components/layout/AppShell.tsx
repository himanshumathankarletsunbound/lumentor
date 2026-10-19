'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
