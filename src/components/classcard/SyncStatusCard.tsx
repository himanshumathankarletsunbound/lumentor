'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { db } from '../../lib/db/store';
import { classcardClient } from '../../lib/integrations/classcard/client';
import { runClasscardSync } from '../../lib/integrations/classcard/sync';
import { RefreshCw, CheckCircle2, AlertTriangle, Key, ExternalLink, ShieldCheck } from 'lucide-react';
import { formatDateTime } from '../../lib/utils/formatters';

export function SyncStatusCard({ onSyncCompleted }: { onSyncCompleted?: () => void }) {
  const [config, setConfig] = useState(db.getClasscardConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKey, setNewKey] = useState('');

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await classcardClient.testConnection();
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection test timed out',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRunSync = async (jobType: 'ALL' | 'STUDENTS' | 'STAFF' | 'EVENTS') => {
    setIsSyncing(true);
    try {
      await runClasscardSync(jobType);
      setConfig(db.getClasscardConfig());
      if (onSyncCompleted) onSyncCompleted();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveKey = () => {
    if (newKey.trim()) {
      db.updateClasscardConfig({
        apiKey: newKey.trim(),
        isConfigured: true,
      });
      setConfig(db.getClasscardConfig());
      setShowKeyModal(false);
      setNewKey('');
    }
  };

  const toggleMockMode = () => {
    const updated = db.updateClasscardConfig({
      useMockMode: !config.useMockMode,
    });
    setConfig({ ...updated });
  };

  // Mask API key for client display: e.g. "cc_live_...40b"
  const maskedKey = config.apiKey
    ? `${config.apiKey.slice(0, 8)}••••••••${config.apiKey.slice(-4)}`
    : 'Not configured';

  return (
    <Card className="border-indigo-100">
      <CardHeader
        title="Classcard Public API v2 Gateway"
        subtitle="Operational Data Source & Synchronization Layer"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMockMode}
              className={`text-xs px-2.5 py-1 rounded-md border font-semibold transition-colors ${
                config.useMockMode
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
              title="Toggle between Live API Gateway and Sandbox simulation"
            >
              Mode: {config.useMockMode ? 'Sandbox / Mock' : 'Live Gateway'}
            </button>
            <Button
              variant="outline"
              size="sm"
              isLoading={isTesting}
              leftIcon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
              onClick={handleTestConnection}
            >
              Test Connection
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSyncing}
              leftIcon={<RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
              onClick={() => handleRunSync('ALL')}
            >
              Sync All Now
            </Button>
          </div>
        }
      />

      <CardContent className="space-y-4 text-xs">
        {/* Test Result Banner */}
        {testResult && (
          <Alert
            type={testResult.success ? 'success' : 'error'}
            title={testResult.success ? 'Connection Verified' : 'Connection Failed'}
            message={testResult.message}
          />
        )}

        {/* Integration Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div>
            <p className="text-slate-400 font-medium">Gateway Base URL</p>
            <p className="font-semibold text-slate-800 font-mono text-[11px] mt-0.5 truncate">
              {config.baseUrl}
            </p>
          </div>

          <div>
            <p className="text-slate-400 font-medium">API Key Credential</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-slate-800 font-semibold">{maskedKey}</span>
              <button
                onClick={() => setShowKeyModal(true)}
                className="text-indigo-600 hover:text-indigo-800 text-[11px] underline"
              >
                Change
              </button>
            </div>
          </div>

          <div>
            <p className="text-slate-400 font-medium">Last Successful Sync</p>
            <p className="font-semibold text-emerald-700 mt-0.5">
              {config.lastSuccessfulSync ? formatDateTime(config.lastSuccessfulSync) : 'Never'}
            </p>
          </div>

          <div>
            <p className="text-slate-400 font-medium">Sync Frequency</p>
            <p className="font-semibold text-slate-800 mt-0.5">
              Every {config.syncIntervalMinutes} mins (Background cron)
            </p>
          </div>
        </div>

        {/* Granular Sync Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-slate-500">
            Incremental sync preserves local changes and deduplicates records by stable external IDs.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isSyncing}
              onClick={() => handleRunSync('STUDENTS')}
            >
              Sync Students
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSyncing}
              onClick={() => handleRunSync('STAFF')}
            >
              Sync Staff
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSyncing}
              onClick={() => handleRunSync('EVENTS')}
            >
              Sync Calendar
            </Button>
          </div>
        </div>

        {/* Change Key Modal */}
        {showKeyModal && (
          <div className="p-4 bg-white border border-indigo-200 rounded-xl space-y-3 shadow-md">
            <h4 className="font-bold text-slate-900 text-sm">Update Classcard API Key</h4>
            <p className="text-slate-500">
              The key is saved in secure server storage and transmitted strictly via the <code className="bg-slate-100 px-1 py-0.5 rounded">api-key</code> header.
            </p>
            <input
              type="password"
              placeholder="Paste new Classcard API key..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowKeyModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveKey} disabled={!newKey.trim()}>
                Save Credentials
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
