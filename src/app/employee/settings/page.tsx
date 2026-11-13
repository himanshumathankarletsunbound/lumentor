'use client';
import { AppShell } from '../../../components/layout/AppShell';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
export default function EmployeeSettingsPage() { return <AppShell><Card><CardHeader title="Employee Settings" subtitle="Manage employee-panel preferences."/><CardContent><p className="text-sm text-slate-600">Employee settings are available here as the panel is expanded.</p></CardContent></Card></AppShell>; }
