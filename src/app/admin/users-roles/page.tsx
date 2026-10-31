'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { Alert } from '../../../components/ui/Alert';
import { UserRole, CurrentUser, SystemRole, UserStatus } from '../../../lib/types/auth';
import {
  Shield,
  Users,
  Plus,
  UserPlus,
  Mail,
  KeyRound,
  Check,
  Copy,
  ExternalLink,
  Trash2,
  Search,
  CheckCircle2,
  Ban,
  Clock,
  Sparkles,
  Lock,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { formatDate } from '../../../lib/utils/formatters';

export default function UsersRolesPage() {
  const [roles, setRoles] = useState<UserRole[]>(() => db.getRoles());
  const [users, setUsers] = useState<CurrentUser[]>(() => db.getUsers());
  const [branches] = useState(() => db.getBranches());

  // Role creation modal state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');

  // Add User modal state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<SystemRole>('OPERATIONS');
  const [userRoleName, setUserRoleName] = useState('Operations Specialist');
  const [userBranchScope, setUserBranchScope] = useState<string>('ALL');
  const [userStatus, setUserStatus] = useState<UserStatus>('SENT_PASSWORD_VERIFICATION');
  const [sendPasswordLink, setSendPasswordLink] = useState(true);
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [showManualPasswordToggle, setShowManualPasswordToggle] = useState(false);

  // Invitation link success modal
  const [showLinkSuccessModal, setShowLinkSuccessModal] = useState(false);
  const [generatedLinkData, setGeneratedLinkData] = useState<{
    name: string;
    email: string;
    resetUrl: string;
    isResend?: boolean;
  } | null>(null);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');

  // Loading & Error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load and refresh users from API
  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        if (Array.isArray(data.roles)) setRoles(data.roles);
      }
    } catch {
      setUsers(db.getUsers());
    }
  }, []);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // Handle Role Selection change in Add User Form
  const handleRoleSelectionChange = (selectedSystemRole: SystemRole) => {
    setUserRole(selectedSystemRole);
    const matched = roles.find((r) => r.systemRole === selectedSystemRole);
    setUserRoleName(matched ? matched.name : selectedSystemRole);
  };

  // Create Role
  const handleCreateRole = async () => {
    if (!roleName.trim()) return;
    const response = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: roleName,
        description: roleDesc || 'Custom authorized organizational role',
        permissions: [
          { module: 'overview', actions: ['view'] },
          { module: 'calendar', actions: ['view'] },
          { module: 'classes', actions: ['view', 'create'] },
          { module: 'attendance', actions: ['view', 'create'] },
          { module: 'reports', actions: ['view', 'export'] },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setActionNotice({ type: 'error', message: data.error || 'Failed to create role.' });
      return;
    }
    await refreshUsers();
    setShowRoleModal(false);
    setRoleName('');
    setRoleDesc('');
    setActionNotice({ type: 'success', message: `Custom role "${roleName}" created successfully.` });
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!userName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!userEmail.trim() || !userEmail.includes('@')) {
      setFormError('A valid email address is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const assignedBranchIds = userBranchScope === 'ALL' ? [] : [userBranchScope];
      const payload = {
        name: userName.trim(),
        email: userEmail.trim().toLowerCase(),
        role: userRole,
        roleName: userRoleName,
        assignedBranchIds,
        sendPasswordSetupEmail: sendPasswordLink,
        status: userStatus,
        initialPassword: initialPassword ? initialPassword.trim() : undefined,
      };

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (!data.success) {
        setFormError(data.error || 'Failed to create user account.');
        return;
      }

      // Refresh users list
      await refreshUsers();
      setShowAddUserModal(false);

      // Reset form
      setUserName('');
      setUserEmail('');
      setUserRole('OPERATIONS');
      setUserRoleName('Operations Specialist');
      setUserBranchScope('ALL');
      setUserStatus('SENT_PASSWORD_VERIFICATION');
      setSendPasswordLink(true);
      setInitialPassword('');
      setShowManualPasswordToggle(false);

      // If a reset/setup link was generated, show the modal
      if (data.resetUrl) {
        setGeneratedLinkData({
          name: payload.name,
          email: payload.email,
          resetUrl: data.resetUrl,
          isResend: false,
        });
        setShowLinkSuccessModal(true);
      } else {
        setActionNotice({
          type: 'success',
          message: `User ${payload.email} created successfully with Active credentials.`,
        });
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err.message || 'Network error creating user.');
    }
  };

  // Resend Password Setup Link
  const handleResendPasswordLink = async (user: CurrentUser) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, action: 'resend_password_link' }),
      });
      const data = await res.json();
      if (data.success && data.resetUrl) {
        await refreshUsers();
        setGeneratedLinkData({
          name: user.name,
          email: user.email,
          resetUrl: data.resetUrl,
          isResend: true,
        });
        setShowLinkSuccessModal(true);
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to generate link' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Error resending link' });
    }
  };

  // Update Status
  const handleUpdateStatus = async (user: CurrentUser, nextStatus: UserStatus) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshUsers();
        setActionNotice({
          type: 'success',
          message: `User status for ${user.email} updated to ${getStatusLabel(nextStatus)}.`,
        });
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to update status' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Error updating status' });
    }
  };

  // Delete User
  const handleDeleteUser = async (user: CurrentUser) => {
    if (!confirm(`Are you sure you want to delete user account ${user.name} (${user.email})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await refreshUsers();
        setActionNotice({ type: 'success', message: `User ${user.email} removed.` });
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to delete user' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Error deleting user' });
    }
  };

  // Copy link helper
  const handleCopyLink = async () => {
    if (!generatedLinkData?.resetUrl) return;
    try {
      await navigator.clipboard.writeText(generatedLinkData.resetUrl);
      setHasCopiedLink(true);
      setTimeout(() => setHasCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const status = u.status || 'ACTIVE';
      if (statusFilter !== 'ALL' && status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !u.roleName.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [users, statusFilter, searchQuery]);

  // Statistics counters
  const totalCount = users.length;
  const activeCount = users.filter((u) => (u.status || 'ACTIVE') === 'ACTIVE').length;
  const pendingCount = users.filter((u) => u.status === 'SENT_PASSWORD_VERIFICATION').length;
  const suspendedCount = users.filter((u) => u.status === 'SUSPENDED').length;
  const disabledCount = users.filter((u) => u.status === 'DISABLED').length;

  function getStatusLabel(s?: UserStatus) {
    switch (s) {
      case 'SENT_PASSWORD_VERIFICATION':
        return 'Sent Password Verification';
      case 'SUSPENDED':
        return 'Suspended';
      case 'DISABLED':
        return 'Disabled';
      case 'ACTIVE':
      default:
        return 'Active';
    }
  }

  function renderStatusBadge(status?: UserStatus) {
    switch (status) {
      case 'SENT_PASSWORD_VERIFICATION':
        return (
          <Badge variant="info" size="sm" dot>
            Sent Password Verification
          </Badge>
        );
      case 'SUSPENDED':
        return (
          <Badge variant="warning" size="sm" dot>
            Suspended
          </Badge>
        );
      case 'DISABLED':
        return (
          <Badge variant="danger" size="sm" dot>
            Disabled
          </Badge>
        );
      case 'ACTIVE':
      default:
        return (
          <Badge variant="success" size="sm" dot>
            Active
          </Badge>
        );
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Users, Roles & Access Control</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                Enterprise RBAC
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage authorized faculty accounts, role-based module security, and password onboarding workflows.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Shield className="w-4 h-4 text-slate-600" />}
              onClick={() => setShowRoleModal(true)}
            >
              Create Role
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => {
                setFormError(null);
                setShowAddUserModal(true);
              }}
            >
              Add User
            </Button>
          </div>
        </div>

        {/* Global Action Notice */}
        {actionNotice && (
          <Alert
            variant={actionNotice.type === 'success' ? 'success' : 'danger'}
            title={actionNotice.type === 'success' ? 'Action Completed' : 'Operation Error'}
            message={actionNotice.message}
            action={
              <button
                onClick={() => setActionNotice(null)}
                className="text-xs font-semibold hover:underline px-2"
              >
                Dismiss
              </button>
            }
          />
        )}

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">All Users</span>
              <Users className="w-4 h-4 opacity-75" />
            </div>
            <p className="text-xl font-bold mt-1">{totalCount}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">Active</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold mt-1 text-emerald-600 group-hover:text-emerald-700">
              {activeCount}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('SENT_PASSWORD_VERIFICATION')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              statusFilter === 'SENT_PASSWORD_VERIFICATION'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">Sent Verification</span>
              <Mail className="w-4 h-4 text-sky-500" />
            </div>
            <p className="text-xl font-bold mt-1 text-sky-600">
              {pendingCount}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('SUSPENDED')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              statusFilter === 'SUSPENDED'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">Suspended</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold mt-1 text-amber-600">
              {suspendedCount}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('DISABLED')}
            className={`p-3.5 rounded-xl border text-left transition-all col-span-2 sm:col-span-1 ${
              statusFilter === 'DISABLED'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">Disabled</span>
              <Ban className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-xl font-bold mt-1 text-rose-600">
              {disabledCount}
            </p>
          </button>
        </div>

        {/* User Directory Card */}
        <Card>
          <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">System User Directory</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorized accounts with designated access scopes and onboarding status
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-colors"
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setFormError(null);
                  setShowAddUserModal(true);
                }}
              >
                Add User
              </Button>
            </div>
          </div>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Account</TableHead>
                  <TableHead>Role & Access Level</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead>Campus Access</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <TableEmptyState
                        title="No users match your filter"
                        description="Try clearing your search query or selecting a different status category."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => {
                    const status = u.status || 'ACTIVE';
                    const isSuperAdmin = u.id === 'user-super-admin' || u.email === 'himanshu.m@letsunbound.com';

                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {isSuperAdmin && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                                    ROOT
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-slate-800">{u.roleName}</p>
                            <Badge
                              variant={
                                u.role === 'ADMINISTRATOR'
                                  ? 'default'
                                  : u.role === 'OPERATIONS'
                                  ? 'warning'
                                  : u.role === 'MENTOR'
                                  ? 'purple'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {u.role}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(status)}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-slate-600">
                          {u.assignedBranchIds.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              All Campuses
                            </span>
                          ) : (
                            <span>{u.assignedBranchIds.join(', ')}</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Resend Password Link Button */}
                            <button
                              type="button"
                              onClick={() => handleResendPasswordLink(u)}
                              title="Send / Resend Password Setup Link"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                              <span className="hidden lg:inline">Setup Link</span>
                            </button>

                            {/* Status Change Selector */}
                            <select
                              value={status}
                              disabled={isSuperAdmin}
                              onChange={(e) => handleUpdateStatus(u, e.target.value as UserStatus)}
                              className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                            >
                              <option value="ACTIVE">Active</option>
                              <option value="SENT_PASSWORD_VERIFICATION">Sent Verification</option>
                              <option value="SUSPENDED">Suspended</option>
                              <option value="DISABLED">Disabled</option>
                            </select>

                            {/* Delete Button (disabled for super admin) */}
                            {!isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                title="Remove User"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Roles Table */}
        <Card>
          <CardHeader title="System & Custom Security Roles" subtitle="Granular module permissions and authorized scope" />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Configured Modules</TableHead>
                  <TableHead>Created Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold text-slate-900">{r.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.systemRole === 'ADMINISTRATOR' ? 'default' : r.systemRole === 'OPERATIONS' ? 'warning' : r.systemRole === 'AUDIT' ? 'warning' : 'success'}
                        size="sm"
                      >
                        {r.systemRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-sm">{r.description}</TableCell>
                    <TableCell className="text-xs text-slate-700 font-semibold">
                      {r.permissions.length} modules configured
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* MODAL: ADD USER */}
        {showAddUserModal && (
          <Modal
            isOpen={showAddUserModal}
            onClose={() => setShowAddUserModal(false)}
            title="Add New User Account"
            subtitle="Create an institutional faculty or operations account and issue password credentials"
            maxWidth="lg"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowAddUserModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateUser as any}
                  isLoading={isSubmitting}
                  leftIcon={<Check className="w-4 h-4" />}
                >
                  Create & Dispatch Setup
                </Button>
              </div>
            }
          >
            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              {formError && (
                <Alert variant="danger" title="Validation Error">
                  {formError}
                </Alert>
              )}

              {/* Full Name */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eleanor Vance"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Institutional Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. eleanor.v@letsunbound.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Role & System Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    System Security Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => handleRoleSelectionChange(e.target.value as SystemRole)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ADMINISTRATOR">Administrator (Full Access)</option>
                    <option value="OPERATIONS">Operations Specialist</option>
                    <option value="AUDIT">Audit Team</option>
                    <option value="MENTOR">Mentor (Faculty Portal)</option>
                    <option value="CUSTOM">Custom Role</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Display Role Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Operations Officer"
                    value={userRoleName}
                    onChange={(e) => setUserRoleName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Campus Access Scope */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Campus / Branch Scope
                </label>
                <select
                  value={userBranchScope}
                  onChange={(e) => setUserBranchScope(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Branches (Global Enterprise Scope)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Initial Status Selection */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Initial Account Status
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label
                    className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer text-[11px] font-medium ${
                      userStatus === 'ACTIVE'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="ACTIVE"
                      checked={userStatus === 'ACTIVE'}
                      onChange={() => setUserStatus('ACTIVE')}
                      className="text-emerald-600"
                    />
                    Active
                  </label>

                  <label
                    className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer text-[11px] font-medium ${
                      userStatus === 'SENT_PASSWORD_VERIFICATION'
                        ? 'bg-sky-50 border-sky-300 text-sky-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="SENT_PASSWORD_VERIFICATION"
                      checked={userStatus === 'SENT_PASSWORD_VERIFICATION'}
                      onChange={() => setUserStatus('SENT_PASSWORD_VERIFICATION')}
                      className="text-sky-600"
                    />
                    Sent Verification
                  </label>

                  <label
                    className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer text-[11px] font-medium ${
                      userStatus === 'SUSPENDED'
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="SUSPENDED"
                      checked={userStatus === 'SUSPENDED'}
                      onChange={() => setUserStatus('SUSPENDED')}
                      className="text-amber-600"
                    />
                    Suspended
                  </label>

                  <label
                    className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer text-[11px] font-medium ${
                      userStatus === 'DISABLED'
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="DISABLED"
                      checked={userStatus === 'DISABLED'}
                      onChange={() => setUserStatus('DISABLED')}
                      className="text-rose-600"
                    />
                    Disabled
                  </label>
                </div>
              </div>

              {/* Password Invitation Checkbox */}
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="send-link-checkbox"
                    checked={sendPasswordLink}
                    onChange={(e) => {
                      setSendPasswordLink(e.target.checked);
                      if (e.target.checked && userStatus === 'ACTIVE') {
                        setUserStatus('SENT_PASSWORD_VERIFICATION');
                      }
                    }}
                    className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-slate-300"
                  />
                  <div>
                    <label htmlFor="send-link-checkbox" className="font-semibold text-slate-900 block cursor-pointer">
                      Send set password verification link to email
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Generates a secure 24-hour setup token allowing the new user to verify their account and configure their institutional password.
                    </p>
                  </div>
                </div>

                {/* Optional manual password accordion */}
                <div className="pt-2 border-t border-indigo-200/50">
                  <button
                    type="button"
                    onClick={() => setShowManualPasswordToggle(!showManualPasswordToggle)}
                    className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {showManualPasswordToggle ? 'Hide manual password override' : 'Or set a manual initial password'}
                  </button>

                  {showManualPasswordToggle && (
                    <div className="mt-2 pt-1">
                      <label className="font-semibold text-slate-700 block mb-1">
                        Manual Initial Password
                      </label>
                      <div className="relative">
                        <input
                          type={showInitialPassword ? 'text' : 'password'}
                          placeholder="Leave empty to use email setup link only"
                          value={initialPassword}
                          onChange={(e) => setInitialPassword(e.target.value)}
                          className="w-full pr-9 p-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowInitialPassword(!showInitialPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          {showInitialPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </Modal>
        )}

        {/* MODAL: SETUP LINK GENERATED */}
        {showLinkSuccessModal && generatedLinkData && (
          <Modal
            isOpen={showLinkSuccessModal}
            onClose={() => setShowLinkSuccessModal(false)}
            title={generatedLinkData.isResend ? 'Password Link Dispatched' : 'User Account & Setup Link Ready'}
            maxWidth="md"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="primary" size="sm" onClick={() => setShowLinkSuccessModal(false)}>
                  Done
                </Button>
              </div>
            }
          >
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">
                    {generatedLinkData.isResend ? 'Setup Link Generated & Sent' : 'Account Created Successfully'}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    An onboarding email was dispatched to <span className="font-semibold">{generatedLinkData.email}</span>.
                  </p>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Direct Password Setup URL (Valid for 24 Hours)
                </label>
                <div className="p-3 bg-slate-900 text-indigo-300 rounded-lg font-mono text-xs break-all select-all border border-slate-800">
                  {generatedLinkData.resetUrl}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  leftIcon={hasCopiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  onClick={handleCopyLink}
                >
                  {hasCopiedLink ? 'Copied to Clipboard!' : 'Copy Direct Link'}
                </Button>

                <Link
                  href={generatedLinkData.resetUrl}
                  target="_blank"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  <span>Open Setup Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </Modal>
        )}

        {/* MODAL: CREATE CUSTOM ROLE */}
        {showRoleModal && (
          <Modal
            isOpen={showRoleModal}
            onClose={() => setShowRoleModal(false)}
            title="Create Custom Security Role"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowRoleModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreateRole} disabled={!roleName.trim()}>
                  Save Role
                </Button>
              </div>
            }
          >
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Campus Compliance Auditor"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role Description</label>
                <textarea
                  rows={2}
                  placeholder="Define the scope and responsibilities for this role..."
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}
