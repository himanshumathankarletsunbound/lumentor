'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { UserRole } from '../../../lib/types/auth';
import { Shield, Users, Plus, Check } from 'lucide-react';
import { formatDate } from '../../../lib/utils/formatters';

export default function UsersRolesPage() {
  const [roles, setRoles] = useState<UserRole[]>(db.getRoles());
  const [users] = useState(db.getUsers());
  const [showModal, setShowModal] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');

  const handleCreateRole = () => {
    if (!roleName.trim()) return;
    const r = db.createRole({
      name: roleName,
      systemRole: 'CUSTOM',
      description: roleDesc || 'Custom authorized organizational role',
      permissions: [
        { module: 'overview', actions: ['view'] },
        { module: 'calendar', actions: ['view'] },
        { module: 'classes', actions: ['view', 'create'] },
        { module: 'attendance', actions: ['view', 'create'] },
        { module: 'reports', actions: ['view', 'export'] },
      ],
    });
    setRoles(db.getRoles());
    setShowModal(false);
    setRoleName('');
    setRoleDesc('');
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Users, Roles & Permissions</h1>
            <p className="text-xs text-slate-500 mt-1">
              Role-based access control, modular permission policies, and user assignments.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowModal(true)}
          >
            Create Custom Role
          </Button>
        </div>

        {/* Roles Table */}
        <Card>
          <CardHeader title="System & Custom Roles" subtitle="Granular module permissions and authorized scope" />
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
                        variant={r.systemRole === 'ADMINISTRATOR' ? 'default' : r.systemRole === 'OPERATIONS' ? 'warning' : 'success'}
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

        {/* User Directory */}
        <Card>
          <CardHeader title="System User Directory" subtitle="Active administrative and operational accounts" />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role Title</TableHead>
                  <TableHead>Role Code</TableHead>
                  <TableHead>Assigned Campus Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-semibold text-slate-900">{u.name}</p>
                      <p className="text-[11px] text-slate-400">{u.email}</p>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 font-medium">{u.roleName}</TableCell>
                    <TableCell>
                      <Badge variant="neutral" size="sm">{u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {u.assignedBranchIds.length === 0 ? 'All Branches (Enterprise)' : u.assignedBranchIds.join(', ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Role Modal */}
        {showModal && (
          <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title="Create Custom Security Role"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
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
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role Description</label>
                <textarea
                  rows={2}
                  placeholder="Define the scope and responsibilities for this role..."
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}
