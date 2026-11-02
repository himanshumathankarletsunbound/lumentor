'use client';

import { AppShell } from '../../components/layout/AppShell';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { useAuth } from '../../lib/auth/AuthContext';

export default function ProfilePage() {
  const { currentUser } = useAuth();

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My profile</h1>
          <p className="mt-1 text-sm text-slate-500">Review your account and workspace access.</p>
        </div>
        <Card>
          <CardHeader title="Account details" subtitle="Your authenticated workspace identity" />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Name</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{currentUser.name || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{currentUser.email || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Role</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{currentUser.roleName || currentUser.role}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
