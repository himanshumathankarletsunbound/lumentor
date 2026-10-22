'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Save, Mail } from 'lucide-react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card, CardContent, CardFooter, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { GoogleWorkspaceEmailSettings } from '../../../components/settings/GoogleWorkspaceEmailSettings';
import { db } from '../../../lib/db/store';
import { setSystemCurrency } from '../../../lib/utils/formatters';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'email'>('general');
  const [orgName, setOrgName] = useState('LUmentor Educational Services');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('America/New_York');
  const [cutoffDay, setCutoffDay] = useState(15);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOrganization = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/org');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load organization settings.');
      setOrgName(data.orgSettings.orgName || 'LUmentor Educational Services');
      setCurrency(data.orgSettings.currency || 'INR');
      setTimezone(data.orgSettings.timezone || 'America/New_York');
      setCutoffDay(data.orgSettings.cutoffDay || 15);
      if (data.orgSettings?.currency) {
        setSystemCurrency(data.orgSettings.currency);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load organization settings.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrganization(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOrganization]);

  const saveOrganization = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch('/api/settings/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, currency, timezone, cutoffDay }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to save organization settings.');
      if (data.orgSettings) {
        db.saveOrgSettings(data.orgSettings);
        setSystemCurrency(data.orgSettings.currency);
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save organization settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">System & Organization Settings</h1>
          <p className="mt-1 text-xs text-slate-500">Manage organization preferences and outbound Google Workspace email.</p>
        </div>

        {error && <Alert variant="danger" title="Settings error" message={error} />}
        {saved && <Alert variant="success" title="Saved" message="Organization preferences updated." />}

        <div className="flex rounded-t-xl border-b border-slate-200 bg-white px-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-xs font-semibold ${activeTab === 'general' ? 'border-indigo-600 bg-indigo-50/40 text-indigo-600' : 'border-transparent text-slate-600'}`}
          >
            <Building2 className="h-4 w-4" /> General Preferences
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-xs font-semibold ${activeTab === 'email' ? 'border-indigo-600 bg-indigo-50/40 text-indigo-600' : 'border-transparent text-slate-600'}`}
          >
            <Mail className="h-4 w-4" /> Google Workspace Email
          </button>
        </div>

        {activeTab === 'general' ? (
          <Card>
            <CardHeader title="Organization Profile" subtitle="General billing, timezone, and cycle information" />
            <CardContent className="space-y-4 text-xs">
              <label className="block font-semibold text-slate-700">
                Organization name
                <input value={orgName} onChange={(event) => setOrgName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal text-slate-900" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block font-semibold text-slate-700">
                  Currency
                  <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal text-slate-900">
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="AED">AED (د.إ) - UAE Dirham</option>
                    <option value="CAD">CAD ($) - Canadian Dollar</option>
                    <option value="AUD">AUD ($) - Australian Dollar</option>
                    <option value="SGD">SGD ($) - Singapore Dollar</option>
                  </select>
                </label>
                <label className="block font-semibold text-slate-700">
                  Timezone
                  <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal text-slate-900">
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </label>
              </div>
              <label className="block font-semibold text-slate-700">
                Payroll cutoff day
                <input type="number" min={1} max={28} value={cutoffDay} onChange={(event) => setCutoffDay(Number(event.target.value))} className="mt-1 w-32 rounded-lg border border-slate-300 p-2 font-normal text-slate-900" />
              </label>
            </CardContent>
            <CardFooter className="justify-end">
              <Button variant="primary" size="sm" isLoading={saving} onClick={() => void saveOrganization()} leftIcon={<Save className="h-4 w-4" />}>
                Save preferences
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <GoogleWorkspaceEmailSettings />
        )}
      </div>
    </AppShell>
  );
}
