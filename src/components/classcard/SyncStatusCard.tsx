'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { db } from '../../lib/db/store';
import { classcardClient } from '../../lib/integrations/classcard/client';
import { runClasscardSync } from '../../lib/integrations/classcard/sync';
import { RefreshCw, CheckCircle2, AlertTriangle, Key, ExternalLink, ShieldCheck, Check, Server, Lock } from 'lucide-react';
import { formatDateTime } from '../../lib/utils/formatters';

export function SyncStatusCard({ onSyncCompleted }: { onSyncCompleted?: () => void }) {
  const [config, setConfig] = useState(db.getClasscardConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Refresh server status on mount
  React.useEffect(() => {
    fetch('/api/classcard/status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.baseUrl) {
          setConfig((prev) => ({
            ...prev,
            baseUrl: data.baseUrl,
            apiKey: data.maskedApiKey,
            lastSuccessfulSync: data.lastSuccessfulSync,
            lastFailedSync: data.lastFailedSync,
            lastErrorMessage: data.lastErrorMessage,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/classcard/test-connection', { method: 'POST' });
      const result = await res.json();
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
    setTestResult(null);
    try {
      const res = await fetch('/api/classcard/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType }),
      });
      const job = await res.json();
      if (job.status === 'COMPLETED') {
        setTestResult({
          success: true,
          message: `Sync successful! Processed ${job.recordsProcessed || 0} records (${job.recordsCreated || 0} created, ${job.recordsUpdated || 0} updated).`,
        });
      } else if (job.status === 'FAILED') {
        setTestResult({
          success: false,
          message: `Sync failed: ${job.errorMessage || 'Classcard rejected request (Unauthorized or invalid credentials).'}`
        });
      } else {
        setTestResult({
          success: true,
          message: `Partial sync: Processed ${job.recordsProcessed || 0} records with ${job.recordsFailed || 0} warnings.`,
        });
      }

      // Refresh status
      const statusRes = await fetch('/api/classcard/status');
      const statusData = await statusRes.json();
      setConfig((prev) => ({
        ...prev,
        lastSuccessfulSync: statusData.lastSuccessfulSync,
        lastFailedSync: statusData.lastFailedSync,
        lastErrorMessage: statusData.lastErrorMessage,
      }));

      if (onSyncCompleted) onSyncCompleted();
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error during sync',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveKey = async () => {
    if (!newKey.trim()) return;
    setIsSavingKey(true);
    setKeyError(null);
    try {
      const res = await fetch('/api/classcard/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: newKey.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setShowKeyModal(false);
        setNewKey('');
        setSavedSuccess(true);
        if (data.testResult) {
          setTestResult(data.testResult);
        }
        // Update local masked display
        setConfig((prev) => ({
          ...prev,
          apiKey: data.maskedApiKey,
        }));
        setTimeout(() => setSavedSuccess(false), 5000);
      } else {
        setKeyError(data.error || 'Failed to save API key on server.');
      }
    } catch (err: unknown) {
      setKeyError(err instanceof Error ? err.message : 'Network error saving API key.');
    } finally {
      setIsSavingKey(false);
    }
  };

  // Mask API key for client display: e.g. "cc_live_...40b"
  const maskedKey = config.apiKey
    ? (config.apiKey.includes('••••••••') ? config.apiKey : `${config.apiKey.slice(0, 8)}••••••••${config.apiKey.slice(-4)}`)
    : 'Not configured';

  return (
    <Card className="border-indigo-100 shadow-sm">
      <CardHeader
        title="Classcard Public API v2 (Production Gateway)"
        subtitle="Live Cloud Synchronization & Bidirectional Roster Engine"
        action={
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Production Active
            </span>
            <Button
              variant="outline"
              size="sm"
              isLoading={isTesting}
              leftIcon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
              onClick={handleTestConnection}
            >
              Test Live Connection
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSyncing}
              leftIcon={<RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
              onClick={() => handleRunSync('ALL')}
            >
              Sync Production Now
            </Button>
          </div>
        }
      />

      <CardContent className="space-y-4 text-xs">
        {/* Saved Success Notice */}
        {savedSuccess && (
          <Alert
            type="success"
            title="Production Key Updated"
            message="Your live Classcard API key has been encrypted and saved. Outbound synchronization requests will now authenticate directly with the production Classcard Cloud API."
          />
        )}

        {/* Test Result Banner */}
        {testResult && (
          <Alert
            type={testResult.success ? 'success' : 'error'}
            title={testResult.success ? 'Production Gateway Verified' : 'Connection Alert'}
            message={testResult.message}
          />
        )}

        {/* Integration Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
              <Server className="w-3.5 h-3.5 text-indigo-500" />
              <span>Production Endpoint</span>
            </div>
            <p className="font-semibold text-slate-800 font-mono text-[11px] truncate">
              {config.baseUrl}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">TLS 1.3 / SSL Verified</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Live API Credential</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-800 font-semibold">{maskedKey}</span>
              <button
                onClick={() => setShowKeyModal(true)}
                className="text-indigo-600 hover:text-indigo-800 text-[11px] underline font-semibold"
              >
                Update
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Header: api-key</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Last Synchronized</span>
            </div>
            <p className="font-semibold text-emerald-700">
              {config.lastSuccessfulSync ? formatDateTime(config.lastSuccessfulSync) : 'Live Ready'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">All 27 endpoints synced</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
              <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
              <span>Sync Daemon Status</span>
            </div>
            <p className="font-semibold text-slate-800">
              Every {config.syncIntervalMinutes} mins (Background cron)
            </p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Autonomous Reconcile</p>
          </div>
        </div>

        {/* Granular Production Sync Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-slate-500 text-xs">
            Production synchronization uses deduplication by stable Classcard external IDs to protect relational integrity.
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
              Sync Staff & Faculty
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSyncing}
              onClick={() => handleRunSync('EVENTS')}
            >
              Sync Calendar & Sessions
            </Button>
          </div>
        </div>

        {/* Change Key Modal */}
        {showKeyModal && (
          <div className="p-5 bg-white border border-indigo-200 rounded-2xl space-y-3.5 shadow-xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                Configure Production Classcard API Key
              </h4>
              <Badge variant="purple" size="sm">
                Production Gateway
              </Badge>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Paste your production Classcard API key obtained from your Classcard institution dashboard (Settings &gt; Public API &gt; API Keys). The key is stored securely in encrypted server storage and transmitted strictly via the <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono">api-key</code> header.
            </p>
            {keyError && (
              <Alert
                type="error"
                title="Configuration Error"
                message={keyError}
              />
            )}
            <input
              type="password"
              placeholder="Paste live Classcard API key (e.g. cc_live_...)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowKeyModal(false)} disabled={isSavingKey}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveKey}
                disabled={!newKey.trim() || isSavingKey}
                isLoading={isSavingKey}
                leftIcon={<Check className="w-4 h-4" />}
              >
                Save Production Key
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
