'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthContext';
import { PermissionModule, SystemRole } from '../../lib/types/auth';
import {
  LayoutDashboard,
  Calendar,
  CalendarClock,
  Clock,
  CheckSquare,
  AlertTriangle,
  GraduationCap,
  Users,
  Building2,
  BookOpen,
  Package as PackageIcon,
  DollarSign,
  Sliders,
  Calculator,
  ShieldAlert,
  FileText,
  FileSpreadsheet,
  CreditCard,
  BarChart3,
  TrendingUp,
  UserCheck,
  RefreshCw,
  History,
  Settings,
  ChevronDown,
  Layers,
  ChevronRight,
  LogOut,
  Sparkles,
  Shield,
  Briefcase,
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  module?: PermissionModule;
  badge?: string;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

let globalSidebarScrollTop = 0;

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { currentUser, isMentor, canAccess } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Persist collapsed groups state across page navigation
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lumentor_sidebar_collapsed_groups');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {};
  });

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const updated = { ...prev, [name]: !prev[name] };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('lumentor_sidebar_collapsed_groups', JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  // Synchronously restore scroll position as soon as DOM element mounts
  const setScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    if (node) {
      let topToRestore = globalSidebarScrollTop;
      if (topToRestore === 0 && typeof window !== 'undefined') {
        try {
          const saved = sessionStorage.getItem('lumentor_sidebar_scroll_top');
          if (saved) topToRestore = Number(saved);
        } catch {}
      }
      if (topToRestore > 0) {
        node.scrollTop = topToRestore;
      }
    }
  }, []);

  // Keep scroll position static across page changes or ensure active link is visible
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let targetScroll = globalSidebarScrollTop;
    if (targetScroll === 0 && typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('lumentor_sidebar_scroll_top');
        if (saved) targetScroll = Number(saved);
      } catch {}
    }

    if (targetScroll > 0) {
      container.scrollTop = targetScroll;
    }

    // If active link is outside visible container bounds, scroll it into view
    const activeLink = container.querySelector<HTMLElement>('[data-active="true"]');
    if (activeLink) {
      const linkRect = activeLink.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (linkRect.top < containerRect.top || linkRect.bottom > containerRect.bottom) {
        activeLink.scrollIntoView({ block: 'nearest' });
        globalSidebarScrollTop = container.scrollTop;
        try {
          sessionStorage.setItem('lumentor_sidebar_scroll_top', String(container.scrollTop));
        } catch {}
      }
    }
  }, [pathname]);

  // Build role-scoped navigation tree
  const getNavGroupsForRole = (role: SystemRole): NavGroup[] => {
    if (role === 'MENTOR') {
      return [
        {
          groupName: 'Faculty Hub',
          items: [
            {
              name: 'Mentor Dashboard',
              href: '/overview/mentor',
              icon: <GraduationCap className="w-4 h-4" />,
            },
            {
              name: 'My Teaching Schedule',
              href: '/operations/calendar',
              icon: <Calendar className="w-4 h-4" />,
            },
            {
              name: 'My Classes',
              href: '/operations/classes',
              icon: <Clock className="w-4 h-4" />,
            },
            {
              name: 'Record Attendance',
              href: '/operations/attendance',
              icon: <CheckSquare className="w-4 h-4" />,
            },
          ],
        },
        {
          groupName: 'Earnings & Records',
          items: [
            {
              name: 'My Payslips',
              href: '/finance/payslips',
              icon: <FileText className="w-4 h-4" />,
            },
            {
              name: 'Deductions & Disputes',
              href: '/finance/penalties',
              icon: <ShieldAlert className="w-4 h-4" />,
            },
          ],
        },
      ];
    }

    if (role === 'OPERATIONS') {
      return [
        {
          groupName: 'Operations Desk',
          items: [
            {
              name: 'Operations Dashboard',
              href: '/overview/operations',
              icon: <Clock className="w-4 h-4" />,
            },
            {
              name: 'Unified Calendar',
              href: '/operations/calendar',
              icon: <Calendar className="w-4 h-4" />,
            },
            {
              name: 'Classes & Sessions',
              href: '/operations/classes',
              icon: <Clock className="w-4 h-4" />,
            },
            {
              name: 'Attendance Console',
              href: '/operations/attendance',
              icon: <CheckSquare className="w-4 h-4" />,
            },
            {
              name: 'Exceptions & Incidents',
              href: '/operations/exceptions',
              icon: <AlertTriangle className="w-4 h-4" />,
            },
          ],
        },
        {
          groupName: 'Directory & Setup',
          items: [
            {
              name: 'Mentors & Faculty',
              href: '/operations/mentors',
              icon: <GraduationCap className="w-4 h-4" />,
            },
            {
              name: 'Student Roster',
              href: '/operations/students',
              icon: <Users className="w-4 h-4" />,
            },
            {
              name: 'Campus Branches',
              href: '/operations/branches',
              icon: <Building2 className="w-4 h-4" />,
            },
            {
              name: 'Subjects & Courses',
              href: '/operations/subjects',
              icon: <BookOpen className="w-4 h-4" />,
            },
            {
              name: 'Packages & Enrolments',
              href: '/operations/packages',
              icon: <PackageIcon className="w-4 h-4" />,
            },
          ],
        },
        {
          groupName: 'Incident Reporting',
          items: [
            {
              name: 'Submit Penalty / Note',
              href: '/finance/penalties',
              icon: <ShieldAlert className="w-4 h-4" />,
            },
            {
              name: 'Attendance Reports',
              href: '/analytics/attendance',
              icon: <BarChart3 className="w-4 h-4" />,
            },
            {
              name: 'Smart Sheet Analytics',
              href: '/analytics/sheet-report',
              icon: <FileSpreadsheet className="w-4 h-4" />,
              badge: 'New',
            },
          ],
        },
      ];
    }

    // Default: ADMINISTRATOR
    return [
      {
        groupName: 'Executive',
        items: [
          {
            name: 'Executive Dashboard',
            href: '/overview/executive',
            icon: <LayoutDashboard className="w-4 h-4" />,
          },
        ],
      },
      {
        groupName: 'Operations & Academic',
        items: [
          {
            name: 'Unified Calendar',
            href: '/operations/calendar',
            icon: <Calendar className="w-4 h-4" />,
            module: 'calendar',
          },
          {
            name: 'Classes & Sessions',
            href: '/operations/classes',
            icon: <Clock className="w-4 h-4" />,
            module: 'classes',
          },
          {
            name: 'Attendance Verification',
            href: '/operations/attendance',
            icon: <CheckSquare className="w-4 h-4" />,
            module: 'attendance',
          },
          {
            name: 'Cancellations & Exceptions',
            href: '/operations/exceptions',
            icon: <AlertTriangle className="w-4 h-4" />,
            module: 'exceptions',
          },
          {
            name: 'Mentors & Faculty',
            href: '/operations/mentors',
            icon: <GraduationCap className="w-4 h-4" />,
            module: 'mentors',
          },
          {
            name: 'Student Roster',
            href: '/operations/students',
            icon: <Users className="w-4 h-4" />,
            module: 'students',
          },
          {
            name: 'Campus Branches',
            href: '/operations/branches',
            icon: <Building2 className="w-4 h-4" />,
            module: 'branches',
          },
          {
            name: 'Subjects',
            href: '/operations/subjects',
            icon: <BookOpen className="w-4 h-4" />,
            module: 'subjects',
          },
          {
            name: 'Packages & Enrolments',
            href: '/operations/packages',
            icon: <PackageIcon className="w-4 h-4" />,
            module: 'packages',
          },
          {
            name: 'Submit Penalties',
            href: '/operations/penalties',
            icon: <ShieldAlert className="w-4 h-4" />,
            module: 'penalties',
          },
        ],
      },
      {
        groupName: 'Finance & Payroll',
        items: [
          {
            name: 'Payroll Dashboard',
            href: '/finance/payroll-dashboard',
            icon: <DollarSign className="w-4 h-4" />,
            module: 'payroll_dashboard',
          },
          {
            name: 'Payroll Rules & Plans',
            href: '/finance/payroll-rules',
            icon: <Sliders className="w-4 h-4" />,
            module: 'payroll_rules',
          },
          {
            name: 'Payout Schedules',
            href: '/finance/payout-schedules',
            icon: <CalendarClock className="w-4 h-4" />,
            module: 'payroll_processing',
          },
          {
            name: 'Process Payroll Batch',
            href: '/finance/payroll-processing',
            icon: <Calculator className="w-4 h-4" />,
            module: 'payroll_processing',
          },
          {
            name: 'Single Payout',
            href: '/finance/single-payout',
            icon: <CreditCard className="w-4 h-4" />,
            module: 'payroll_processing',
          },
          {
            name: 'Penalties & Policy Deductions',
            href: '/finance/penalties',
            icon: <ShieldAlert className="w-4 h-4" />,
            module: 'penalties',
          },
          {
            name: 'Official Payslips',
            href: '/finance/payslips',
            icon: <FileText className="w-4 h-4" />,
            module: 'payslips',
          },
          {
            name: 'Payment History',
            href: '/finance/payment-history',
            icon: <CreditCard className="w-4 h-4" />,
            module: 'payroll_dashboard',
          },
          {
            name: 'Payroll Reports',
            href: '/finance/reports',
            icon: <BarChart3 className="w-4 h-4" />,
            module: 'reports',
          },
        ],
      },
      {
        groupName: 'Analytics',
        items: [
          {
            name: 'Smart Sheet Analytics',
            href: '/analytics/sheet-report',
            icon: <FileSpreadsheet className="w-4 h-4" />,
            module: 'analytics',
            badge: 'Smart',
          },
          {
            name: 'Attendance Analytics',
            href: '/analytics/attendance',
            icon: <CheckSquare className="w-4 h-4" />,
            module: 'analytics',
          },
          {
            name: 'Class Utilization',
            href: '/analytics/class-utilization',
            icon: <TrendingUp className="w-4 h-4" />,
            module: 'analytics',
          },
          {
            name: 'Mentor Performance',
            href: '/analytics/mentor-performance',
            icon: <UserCheck className="w-4 h-4" />,
            module: 'analytics',
          },
          {
            name: 'Branch Performance',
            href: '/analytics/branch-performance',
            icon: <Building2 className="w-4 h-4" />,
            module: 'analytics',
          },
          {
            name: 'Spend Analytics',
            href: '/analytics/payroll',
            icon: <BarChart3 className="w-4 h-4" />,
            module: 'analytics',
          },
          {
            name: 'Sync Reports',
            href: '/analytics/sync-reports',
            icon: <RefreshCw className="w-4 h-4" />,
            module: 'analytics',
          },
        ],
      },
      {
        groupName: 'Administration',
        items: [
          {
            name: 'Users & Roles',
            href: '/admin/users-roles',
            icon: <Users className="w-4 h-4" />,
            module: 'users_roles',
          },
          {
            name: 'Classcard Integration',
            href: '/admin/classcard-integration',
            icon: <RefreshCw className="w-4 h-4" />,
            module: 'classcard_integration',
          },
          {
            name: 'Custom Fields & Schema',
            href: '/admin/custom-fields',
            icon: <Sliders className="w-4 h-4" />,
            module: 'settings',
          },
          {
            name: 'Audit Trail Logs',
            href: '/admin/audit-logs',
            icon: <History className="w-4 h-4" />,
            module: 'audit_logs',
          },
          {
            name: 'System Settings',
            href: '/admin/settings',
            icon: <Settings className="w-4 h-4" />,
            module: 'settings',
          },
        ],
      },
    ];
  };

  const navGroups = getNavGroupsForRole(currentUser.role);

  const getRoleBadge = (role: SystemRole) => {
    switch (role) {
      case 'ADMINISTRATOR':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'OPERATIONS':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
            <Briefcase className="w-3 h-3" /> Operations
          </span>
        );
      case 'MENTOR':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <GraduationCap className="w-3 h-3" /> Faculty
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Persistent Left Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 h-screen max-h-screen bg-slate-950 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out border-r border-slate-800/80 shadow-2xl shrink-0',
          'lg:static lg:h-screen lg:max-h-screen lg:shrink-0 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-slate-950/90">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight leading-none block">
                LUmentor
              </span>
              <span className="text-[10px] text-indigo-400 font-medium tracking-wider uppercase block mt-1">
                Classcard Integrated
              </span>
            </div>
          </Link>
        </div>

        {/* User Persona Banner */}
        <div className="px-3.5 py-3 border-b border-slate-800/60 bg-slate-900/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0">
                {currentUser.name[0]}
              </div>
              <div className="truncate">
                <p className="font-semibold text-slate-200 text-xs truncate leading-tight">
                  {currentUser.name}
                </p>
                <div className="mt-0.5">{getRoleBadge(currentUser.role)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Groups */}
        <div
          ref={setScrollContainerRef}
          onScroll={(e) => {
            const top = e.currentTarget.scrollTop;
            globalSidebarScrollTop = top;
            try {
              sessionStorage.setItem('lumentor_sidebar_scroll_top', String(top));
            } catch {}
          }}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-6 text-sm"
        >
          {navGroups.map((group) => {
            const isCollapsed = collapsedGroups[group.groupName];

            return (
              <div key={group.groupName} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.groupName)}
                  className="w-full px-2.5 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <span>{group.groupName}</span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="space-y-0.5 pt-1">
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== '/' &&
                          item.href !== '/overview/executive' &&
                          item.href !== '/overview/operations' &&
                          item.href !== '/overview/mentor' &&
                          pathname.startsWith(`${item.href}/`));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          scroll={false}
                          data-active={isActive ? 'true' : undefined}
                          onClick={() => {
                            if (scrollContainerRef.current) {
                              globalSidebarScrollTop = scrollContainerRef.current.scrollTop;
                              try {
                                sessionStorage.setItem('lumentor_sidebar_scroll_top', String(globalSidebarScrollTop));
                              } catch {}
                            }
                            if (window.innerWidth < 1024) onClose();
                          }}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group relative',
                            isActive
                              ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                          )}
                        >
                          <span
                            className={cn(
                              'shrink-0 transition-colors',
                              isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                            )}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.name}</span>
                          {item.badge && (
                            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sync Status & Sign Out in Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/70 space-y-2.5 shrink-0">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-medium text-[11px]">Classcard API v2</span>
            </div>
            <Link
              href="/admin/classcard-integration"
              className="text-indigo-400 hover:text-indigo-300 text-[11px] font-semibold"
            >
              Active
            </Link>
          </div>

          <div className="flex items-center justify-between px-2 pt-1 text-xs">
            <Link
              href="/login"
              className="flex items-center gap-2 text-slate-400 hover:text-rose-400 transition-colors text-[11px] font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch / Sign Out</span>
            </Link>
            <span className="text-[10px] text-slate-600">v2.4.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
