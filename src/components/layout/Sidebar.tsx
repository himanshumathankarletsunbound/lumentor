'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthContext';
import { PermissionModule } from '../../lib/types/auth';
import {
  LayoutDashboard,
  Calendar,
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
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  module: PermissionModule;
  mentorOnly?: boolean;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { canAccess, isMentor } = useAuth();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const navGroups: NavGroup[] = [
    {
      groupName: 'Overview',
      items: [
        {
          name: 'Executive Dashboard',
          href: '/overview/executive',
          icon: <LayoutDashboard className="w-4 h-4" />,
          module: 'overview',
        },
        {
          name: 'Operations Dashboard',
          href: '/overview/operations',
          icon: <Clock className="w-4 h-4" />,
          module: 'overview',
        },
        {
          name: 'Mentor Dashboard',
          href: '/overview/mentor',
          icon: <GraduationCap className="w-4 h-4" />,
          module: 'overview',
        },
      ],
    },
    {
      groupName: 'Operations',
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
          name: 'Attendance',
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
          name: 'Mentors & Staff',
          href: '/operations/mentors',
          icon: <GraduationCap className="w-4 h-4" />,
          module: 'mentors',
        },
        {
          name: 'Students',
          href: '/operations/students',
          icon: <Users className="w-4 h-4" />,
          module: 'students',
        },
        {
          name: 'Branches',
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
          name: 'Payroll Rules',
          href: '/finance/payroll-rules',
          icon: <Sliders className="w-4 h-4" />,
          module: 'payroll_rules',
        },
        {
          name: 'Payroll Processing',
          href: '/finance/payroll-processing',
          icon: <Calculator className="w-4 h-4" />,
          module: 'payroll_processing',
        },
        {
          name: 'Penalties & Adjustments',
          href: '/finance/penalties',
          icon: <ShieldAlert className="w-4 h-4" />,
          module: 'penalties',
        },
        {
          name: 'Payslips',
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
          name: 'Payroll Analytics',
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
          name: 'Custom Fields & Mappings',
          href: '/admin/custom-fields',
          icon: <Sliders className="w-4 h-4" />,
          module: 'settings',
        },
        {
          name: 'Audit Logs',
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

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Persistent Left Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out border-r border-slate-800 shadow-xl lg:shadow-none lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20 group-hover:bg-indigo-500 transition-colors">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight leading-none block">
                Apex Portal
              </span>
              <span className="text-[10px] text-indigo-400 font-medium tracking-wider uppercase block mt-0.5">
                Classcard Integrated
              </span>
            </div>
          </Link>
        </div>

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-sm">
          {navGroups.map((group) => {
            // Filter items by permission
            const visibleItems = group.items.filter((item) => {
              if (isMentor) {
                // If logged in as mentor, show only mentor dashboard, calendar, personal penalties, personal payslips
                if (item.href === '/overview/executive' || item.href === '/overview/operations') return false;
                if (item.href === '/overview/mentor' || item.href === '/operations/calendar' || item.href === '/finance/penalties' || item.href === '/finance/payslips') return true;
                return false;
              }
              return canAccess(item.module);
            });

            if (visibleItems.length === 0) return null;
            const isCollapsed = collapsedGroups[group.groupName];

            return (
              <div key={group.groupName} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.groupName)}
                  className="w-full px-2 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <span>{group.groupName}</span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="space-y-0.5 pt-0.5">
                    {visibleItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => {
                            if (window.innerWidth < 1024) onClose();
                          }}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                            isActive
                              ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
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
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sync Status Badge in Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">Classcard v2</span>
            </div>
            <Link
              href="/admin/classcard-integration"
              className="text-indigo-400 hover:text-indigo-300 text-[11px] font-medium"
            >
              Sync Active
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
