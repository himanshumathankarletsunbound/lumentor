'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Card, CardHeader, CardContent, CardFooter } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { Save, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
  const [orgName, setOrgName] = useState('LUmentor Educational Services');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/New_York');
  const [cutoffDay, setCutoffDay] = useState('15');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset all records to the default seed state?')) {
      db.resetToSeed();
      window.location.reload();
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System & Organization Settings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Global institution preferences, default currency, and testing resets.
          </p>
        </div>

        {saved && (
          <Alert type="success" title="Settings Saved" message="Institutional settings updated successfully." />
        )}

        <Card>
          <CardHeader title="Organization Profile" subtitle="General billing and entity information" />
          <CardContent className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Default Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                  <option value="CAD">CAD ($) - Canadian Dollar</option>
                  <option value="AUD">AUD ($) - Australian Dollar</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Primary Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  <option value="Europe/London">London (GMT)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Semi-Monthly Payroll Cutoff Day</label>
              <input
                type="number"
                value={cutoffDay}
                onChange={(e) => setCutoffDay(e.target.value)}
                className="w-32 p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
              <p className="text-slate-400 text-[11px] mt-1">Default is day 15 and last day of month.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="primary" size="sm" leftIcon={<Save className="w-4 h-4" />} onClick={handleSave}>
              Save Preferences
            </Button>
          </CardFooter>
        </Card>

        {/* Database Reset Action */}
        <Card className="border-rose-200">
          <CardHeader
            title="Development Data Management"
            subtitle="Reset application records to default seed state"
          />
          <CardContent className="space-y-3 text-xs">
            <p className="text-slate-600">
              Resetting will repopulate sample students, mentors, class events, approved batches, and Classcard integration endpoints.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 border-rose-300 hover:bg-rose-50"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleResetData}
            >
              Reset Database to Seed State
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
