'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card, CardHeader, CardContent, CardFooter } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { EmailConfig } from '../../../lib/types/email';
import {
  Save,
  RefreshCw,
  Mail,
  Building2,
  CheckCircle2,
  AlertCircle,
  Send,
  Eye,
  EyeOff,
  ShieldCheck,
  Server,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '../../../lib/utils/formatters';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'email'>('general');

  // General Settings State
  const [orgName, setOrgName] = useState('LUmentor Educational Services');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/New_York');
  const [cutoffDay, setCutoffDay] = useState(15);
  const [generalSaved, setGeneralSaved] = useState(false);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Email Settings State
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    host: 'smtp.letsunbound.com',
    port: 587,
    security: 'STARTTLS',
    authRequired: true,
    user: 'notifications@letsunbound.com',
    pass: '',
    fromEmail: 'notifications@letsunbound.com',
    fromName: 'LUmentor Faculty & Operations',
    replyTo: 'support@letsunbound.com',
    allowSelfSignedCert: false,
    isEnabled: false,
    lastTestStatus: 'UNTESTED',
  });
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Test Email Modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState('himanshu.m@letsunbound.com');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch settings from API on mount
  const loadSettings = useCallback(async () => {
    try {
      // 1. Fetch Organization settings
      const orgRes = await fetch('/api/settings/org');
      const orgData = await orgRes.json();
      if (orgData.success && orgData.orgSettings) {
        setOrgName(orgData.orgSettings.orgName || 'LUmentor Educational Services');
        setCurrency(orgData.orgSettings.currency || 'USD');
        setTimezone(orgData.orgSettings.timezone || 'America/New_York');
        setCutoffDay(orgData.orgSettings.cutoffDay || 15);
      }
    } catch {
      setOrgName('LUmentor Educational Services');
      setCurrency('USD');
      setTimezone('America/New_York');
      setCutoffDay(15);
    }

    try {
      // 2. Fetch Email settings
      const emailRes = await fetch('/api/settings/email');
      const emailData = await emailRes.json();
      if (emailData.success && emailData.emailConfig) {
        setEmailConfig({
          ...emailData.emailConfig,
          pass: '', // Keep client password field blank for safety
          oauthClientSecret: '',
        });
        setHasStoredPassword(Boolean(emailData.emailConfig.hasPassword));
        setOauthConfigured(Boolean(emailData.emailConfig.oauthConfigured));
        setOauthConnected(Boolean(emailData.emailConfig.oauthConnected));
      }
    } catch {
      setHasStoredPassword(false);
      setOauthConfigured(false);
      setOauthConnected(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSettings(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const oauthStatus = params.get('emailOAuth');
      if (oauthStatus === 'success') {
        setOauthConnected(true);
        setEmailSaved(true);
        setEmailError(null);
      } else if (oauthStatus === 'error') {
        setEmailError(params.get('message') || 'Gmail authorization was cancelled or failed.');
      }
      if (oauthStatus) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Handle General Settings Save
  const handleSaveGeneral = async () => {
    setIsSavingGeneral(true);
    setGeneralSaved(false);
    try {
      const res = await fetch('/api/settings/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, currency, timezone, cutoffDay }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneralSaved(true);
        setTimeout(() => setGeneralSaved(false), 4000);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save organization preferences.');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Handle Email Settings Save
  const handleSaveEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingEmail(true);
    setEmailSaved(false);
    setEmailError(null);

    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailConfig),
      });
      const data = await res.json();
      if (data.success) {
        setEmailSaved(true);
        if (data.emailConfig) {
          setHasStoredPassword(Boolean(data.emailConfig.hasPassword));
          setEmailConfig((prev) => ({
            ...prev,
            ...data.emailConfig,
            pass: '',
          }));
        }
        setTimeout(() => setEmailSaved(false), 4000);
      } else {
        setEmailError(data.error || 'Failed to save email configuration.');
      }
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : 'Network error saving email configuration.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Handle Test Email
  const handleSendTestEmail = async () => {
    if (!testRecipient.trim() || !testRecipient.includes('@')) {
      alert('Please enter a valid recipient email address.');
      return;
    }

    setIsTestingEmail(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testRecipient.trim(),
          ...emailConfig,
        }),
      });

      const data = await res.json();
      setIsTestingEmail(false);

      if (data.success) {
        setTestResult({
          success: true,
          message: data.message || `Test email successfully dispatched to ${testRecipient}.`,
        });
        setEmailConfig((prev) => ({
          ...prev,
          lastTestStatus: 'SUCCESS',
          lastTestedAt: new Date().toISOString(),
          lastTestMessage: data.message,
        }));
      } else {
        setTestResult({
          success: false,
          message: data.error || data.message || 'SMTP connection failed. Check host, port, and credentials.',
        });
        setEmailConfig((prev) => ({
          ...prev,
          lastTestStatus: 'FAILED',
          lastTestedAt: new Date().toISOString(),
          lastTestMessage: data.error,
        }));
      }
    } catch (err: unknown) {
      setIsTestingEmail(false);
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error executing SMTP test.',
      });
    }
  };

  // Presets Helper
  const applyPreset = (preset: 'company_587' | 'company_465' | 'zoho' | 'exchange' | 'google' | 'google_oauth' | 'brevo' | 'resend') => {
    if (preset === 'google_oauth') {
      setEmailConfig((prev) => ({
        ...prev,
        authType: 'OAUTH2',
        host: 'smtp.gmail.com',
        port: 465,
        security: 'SSL_TLS',
        authRequired: true,
      }));
    } else if (preset === 'brevo') {
      setEmailConfig((prev) => ({
        ...prev,
        host: 'smtp-relay.brevo.com',
        port: 587,
        security: 'STARTTLS',
        authRequired: true,
      }));
    } else if (preset === 'resend') {
      setEmailConfig((prev) => ({
        ...prev,
        host: 'smtp.resend.com',
        port: 465,
        security: 'SSL_TLS',
        user: 'resend',
        authRequired: true,
      }));
    } else if (preset === 'google') {
      setEmailConfig((prev) => ({
        ...prev,
        host: 'smtp.gmail.com',
        port: 587,
        security: 'STARTTLS',
        authRequired: true,
      }));
    } else if (preset === 'company_587') {
      setEmailConfig((prev) => ({
        ...prev,
        port: 587,
        security: 'STARTTLS',
        authRequired: true,
      }));
    } else if (preset === 'company_465') {
      setEmailConfig((prev) => ({
        ...prev,
        port: 465,
        security: 'SSL_TLS',
        authRequired: true,
      }));
    } else if (preset === 'zoho') {
      setEmailConfig((prev) => ({
        ...prev,
        host: 'smtp.zoho.com',
        port: 465,
        security: 'SSL_TLS',
        authRequired: true,
      }));
    } else if (preset === 'exchange') {
      setEmailConfig((prev) => ({
        ...prev,
        host: 'smtp.office365.com',
        port: 587,
        security: 'STARTTLS',
        authRequired: true,
      }));
    }
  };

  const handleResetData = () => {
    alert('Reset is available only through the server-side demo environment.');
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System & Organization Settings</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                Administration
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure corporate email dispatch, organization preferences, and system defaults.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>General Preferences</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'email'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email Configuration</span>
            {emailConfig.isEnabled ? (
              <Badge variant="success" size="sm" dot>
                Active
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Disabled
              </Badge>
            )}
          </button>
        </div>

        {/* TAB 1: GENERAL & ORGANIZATION PREFERENCES */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {generalSaved && (
              <Alert variant="success" title="Preferences Saved" message="Institutional settings updated successfully." />
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Default Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="INR">INR (₹) - Indian Rupee</option>
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
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Asia/Kolkata">India Standard Time (IST - Asia/Kolkata)</option>
                      <option value="America/New_York">Eastern Time (US & Canada)</option>
                      <option value="America/Chicago">Central Time (US & Canada)</option>
                      <option value="America/Denver">Mountain Time (US & Canada)</option>
                      <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                      <option value="Europe/London">London (GMT / BST)</option>
                      <option value="Asia/Dubai">Dubai (GST)</option>
                      <option value="Asia/Singapore">Singapore (SGT)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Semi-Monthly Payroll Cutoff Day</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={cutoffDay}
                    onChange={(e) => setCutoffDay(Number(e.target.value))}
                    className="w-32 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-slate-400 text-[11px] mt-1">Default cycle 1 ends on day 15; cycle 2 ends on the last day of the month.</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Save className="w-4 h-4" />}
                  isLoading={isSavingGeneral}
                  onClick={handleSaveGeneral}
                >
                  Save Preferences
                </Button>
              </CardFooter>
            </Card>

            {/* Development / Maintenance Reset */}
            <Card className="border-rose-200">
              <CardHeader
                title="Development Data Management"
                subtitle="Reset application records to default seed state"
              />
              <CardContent className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Resets database to clean initial state with zero demo activity and restores default administrative configurations.
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
        )}

        {/* TAB 2: EMAIL / SMTP CONFIGURATION */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            {emailSaved && (
              <Alert variant="success" title="Email Settings Saved" message="Company SMTP configuration updated and stored securely." />
            )}

            {emailError && (
              <Alert variant="danger" title="Configuration Error" message={emailError} />
            )}

            {/* Explanatory Banner for Company Custom Mail */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-slate-800 shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      Corporate Mail Server (Non-Google Workspace)
                    </span>
                  </div>
                  <h3 className="text-lg font-bold">Custom Company SMTP Setup</h3>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    Connect your organization&apos;s custom domain email server (e.g., cPanel Webmail, Zimbra, Zoho, Exchange, Hostinger, or corporate SMTP relay). This server handles automated faculty onboarding invitations, password recovery links, and operational notifications.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 text-white hover:bg-white/20 border-white/20"
                    leftIcon={<Send className="w-3.5 h-3.5 text-indigo-300" />}
                    onClick={() => {
                      setTestResult(null);
                      setShowTestModal(true);
                    }}
                  >
                    Send Test Email
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Port Presets */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Quick Presets for Corporate Mail Servers:
                </span>
                <span className="text-[11px] text-slate-400">Click to automatically set port & encryption</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('google_oauth')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Google OAuth 2.0 (Official Cloud Relay)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('brevo')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold transition-colors"
                >
                  Brevo / Sendinblue (smtp-relay.brevo.com)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('resend')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-violet-50 border border-violet-200 text-violet-700 font-semibold transition-colors"
                >
                  Resend (smtp.resend.com)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('google')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold transition-colors"
                >
                  Google Workspace / Gmail (smtp.gmail.com)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('company_587')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 transition-colors"
                >
                  Standard Company Mail (Port 587 • STARTTLS)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('company_465')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 transition-colors"
                >
                  Secure SSL/TLS (Port 465)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('zoho')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 transition-colors"
                >
                  Zoho Mail (smtp.zoho.com)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('exchange')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 transition-colors"
                >
                  Office 365 / Exchange (smtp.office365.com)
                </button>
              </div>
            </div>

            {/* Email Configuration Form */}
            <form onSubmit={handleSaveEmail}>
              <Card>
                <CardHeader
                  title="SMTP Server Connection & Authentication"
                  subtitle="Configure your outgoing corporate mail relay credentials"
                />
                <CardContent className="space-y-4 text-xs">
                  {/* Host and Port */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-semibold text-slate-700 block mb-1">
                        SMTP Server Host <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Server className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. mail.letsunbound.com or smtp.yourcompany.com"
                          value={emailConfig.host}
                          onChange={(e) => setEmailConfig({ ...emailConfig, host: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Provided by your company domain hosting or IT mail provider.</p>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        SMTP Port <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={emailConfig.port}
                        onChange={(e) => setEmailConfig({ ...emailConfig, port: Number(e.target.value) })}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Typically 587 (STARTTLS) or 465 (SSL).</p>
                    </div>
                  </div>

                  {/* Encryption Protocol */}
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Transport Encryption & Security
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${
                          emailConfig.security === 'STARTTLS'
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="security"
                          value="STARTTLS"
                          checked={emailConfig.security === 'STARTTLS'}
                          onChange={() => setEmailConfig({ ...emailConfig, security: 'STARTTLS' })}
                          className="text-indigo-600"
                        />
                        <span>STARTTLS (587)</span>
                      </label>

                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${
                          emailConfig.security === 'SSL_TLS'
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="security"
                          value="SSL_TLS"
                          checked={emailConfig.security === 'SSL_TLS'}
                          onChange={() => setEmailConfig({ ...emailConfig, security: 'SSL_TLS' })}
                          className="text-indigo-600"
                        />
                        <span>SSL / TLS (465)</span>
                      </label>

                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${
                          emailConfig.security === 'NONE'
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="security"
                          value="NONE"
                          checked={emailConfig.security === 'NONE'}
                          onChange={() => setEmailConfig({ ...emailConfig, security: 'NONE' })}
                          className="text-indigo-600"
                        />
                        <span>None (Unencrypted)</span>
                      </label>
                    </div>
                  </div>

                  {/* Authentication Protocol Selector */}
                  <div className="pt-2 border-t border-slate-200/80">
                    <label className="font-semibold text-slate-700 block mb-2">
                      Authentication Protocol & Credentials Type
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label
                        className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                          emailConfig.authType !== 'OAUTH2'
                            ? 'bg-indigo-50/70 border-indigo-400 text-indigo-950 font-semibold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="authType"
                          value="PASSWORD"
                          checked={emailConfig.authType !== 'OAUTH2'}
                          onChange={() => setEmailConfig({ ...emailConfig, authType: 'PASSWORD' })}
                          className="text-indigo-600 mt-0.5"
                        />
                        <div>
                          <span className="block text-xs font-semibold">Standard SMTP Password / App Password</span>
                          <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                            Traditional mail server password or Google App Password
                          </span>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                          emailConfig.authType === 'OAUTH2'
                            ? 'bg-indigo-50/70 border-indigo-400 text-indigo-950 font-semibold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="authType"
                          value="OAUTH2"
                          checked={emailConfig.authType === 'OAUTH2'}
                          onChange={() =>
                            setEmailConfig({
                              ...emailConfig,
                              authType: 'OAUTH2',
                              host: 'smtp.gmail.com',
                              port: 465,
                              security: 'SSL_TLS',
                            })
                          }
                          className="text-indigo-600 mt-0.5"
                        />
                        <div>
                          <span className="block text-xs font-semibold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            Google OAuth 2.0 (No 2-Step Verification Needed)
                          </span>
                          <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                            Official Google Cloud Client ID, Secret & Refresh Token
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* GOOGLE OAUTH 2.0 CREDENTIALS INPUTS */}
                  {emailConfig.authType === 'OAUTH2' ? (
                    <div className="space-y-3 pt-2 border-t border-slate-200/80 bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          Google Cloud OAuth 2.0 Credentials
                        </span>
                        <div className="flex items-center gap-3">
                          <a
                            href="/api/settings/email/oauth/authorize"
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                          >
                            Connect Gmail securely
                          </a>
                          <a
                            href="https://console.cloud.google.com/apis/credentials"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline flex items-center gap-1"
                          >
                            Google Cloud credentials ↗
                          </a>
                        </div>
                      </div>

                      <div className={`rounded-lg border p-3 text-xs ${oauthConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        <div className="flex items-center gap-2 font-semibold">
                          {oauthConnected ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                          {oauthConnected ? 'Gmail account connected' : 'Gmail account not connected'}
                        </div>
                        <p className="mt-1">
                          {oauthConfigured
                            ? 'Select Connect Gmail securely to authorize sending. The refresh token is stored encrypted on the server.'
                            : 'Configure GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI, and APP_ENCRYPTION_KEY on Vercel before connecting.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">
                            Google Account Email <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="e.g. recruitment@letsunbound.com"
                            value={emailConfig.user}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEmailConfig((prev) => ({
                                ...prev,
                                user: val,
                                fromEmail: !prev.fromEmail || prev.fromEmail === '587' || !prev.fromEmail.includes('@') ? val : prev.fromEmail,
                              }));
                            }}
                            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">
                            Google OAuth Client ID <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="xxxx-xxxxxxxx.apps.googleusercontent.com"
                            value={emailConfig.oauthClientId || ''}
                            onChange={(e) => setEmailConfig({ ...emailConfig, oauthClientId: e.target.value })}
                            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">
                            OAuth Refresh Token
                          </label>
                          <div className="rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-500">
                            Never paste a refresh token here. Use <strong>Connect Gmail securely</strong>; LUmentor exchanges the authorization code server-side and stores the token encrypted.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* STANDARD PASSWORD INPUTS */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          SMTP Username / Account Email <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. recruitment@letsunbound.com"
                          value={emailConfig.user}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmailConfig((prev) => ({
                              ...prev,
                              user: val,
                              fromEmail: !prev.fromEmail || prev.fromEmail === '587' || !prev.fromEmail.includes('@') ? val : prev.fromEmail,
                            }));
                          }}
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          SMTP Password / Secret <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={hasStoredPassword ? '•••••••••••• (Leave blank to keep existing)' : 'Enter SMTP password'}
                            value={emailConfig.pass}
                            onChange={(e) => setEmailConfig({ ...emailConfig, pass: e.target.value })}
                            className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {hasStoredPassword && (
                          <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Password is encrypted in store. Enter a new value only to update.
                          </p>
                        )}
                      </div>

                      {/* Google App Password Requirement Notice */}
                      {(emailConfig.host.toLowerCase().includes('gmail') || emailConfig.host.toLowerCase().includes('google')) && (
                        <div className="col-span-1 sm:col-span-2 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
                          <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Google Account Notice: 16-Character App Password Required</span>
                          </div>
                          <p className="text-[11px] text-amber-900 leading-relaxed">
                          Google blocks standard account passwords on SMTP with error <strong>535-5.7.8 (BadCredentials)</strong>. You <strong>cannot</strong> use your personal login password. You must generate a <strong>Google App Password</strong>:
                        </p>
                        <ol className="list-decimal pl-4 text-[11px] text-amber-900 space-y-1">
                          <li>
                            Open Google Security Settings:{' '}
                            <a
                              href="https://myaccount.google.com/security"
                              target="_blank"
                              rel="noreferrer"
                              className="underline font-semibold text-indigo-700"
                            >
                              myaccount.google.com/security
                            </a>
                          </li>
                          <li>Make sure <strong>2-Step Verification</strong> is enabled for <code>{emailConfig.user || 'your account'}</code>.</li>
                          <li>
                            Open App Passwords directly:{' '}
                            <a
                              href="https://myaccount.google.com/apppasswords"
                              target="_blank"
                              rel="noreferrer"
                              className="underline font-semibold text-indigo-700"
                            >
                              myaccount.google.com/apppasswords
                            </a>
                          </li>
                          <li>Type app name <code>LUmentor</code> and click <strong>Create</strong>.</li>
                          <li>Copy the 16-character code (e.g. <code>abcd efgh ijkl mnop</code>) and paste it into the <strong>SMTP Password</strong> field above.</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                  {/* Sender Identity */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs">Sender Identity & Headers</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          From Email Address <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. notifications@letsunbound.com"
                          value={emailConfig.fromEmail}
                          onChange={(e) => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })}
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          Sender Display Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. LUmentor Faculty Portal"
                          value={emailConfig.fromName}
                          onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Reply-To Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. support@letsunbound.com"
                        value={emailConfig.replyTo || ''}
                        onChange={(e) => setEmailConfig({ ...emailConfig, replyTo: e.target.value })}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Recipient responses will be directed to this inbox.</p>
                    </div>
                  </div>

                  {/* Advanced Options & Enablement */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="self-signed-checkbox"
                        checked={emailConfig.allowSelfSignedCert}
                        onChange={(e) => setEmailConfig({ ...emailConfig, allowSelfSignedCert: e.target.checked })}
                        className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-slate-300"
                      />
                      <div>
                        <label htmlFor="self-signed-checkbox" className="font-semibold text-slate-800 block cursor-pointer">
                          Allow self-signed or internal SSL certificates
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Recommended if your company uses a private mail server or custom internal certificate authority.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="enable-email-checkbox"
                        checked={emailConfig.isEnabled}
                        onChange={(e) => setEmailConfig({ ...emailConfig, isEnabled: e.target.checked })}
                        className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-slate-300"
                      />
                      <div>
                        <label htmlFor="enable-email-checkbox" className="font-bold text-indigo-950 block cursor-pointer">
                          Enable Outbound Email Dispatch via this Server
                        </label>
                        <p className="text-[11px] text-indigo-900/80 mt-0.5 leading-relaxed">
                          When checked, user invitation setup links, password resets, and operational alerts will be actively transmitted through your company SMTP server.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Test Summary */}
                  {emailConfig.lastTestedAt && (
                    <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        {emailConfig.lastTestStatus === 'SUCCESS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                        )}
                        <span className="font-medium text-slate-700">
                          Last Tested: {formatDate(emailConfig.lastTestedAt)} — Status: {emailConfig.lastTestStatus}
                        </span>
                      </div>
                      <span className="text-slate-500 truncate max-w-xs">{emailConfig.lastTestMessage}</span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    leftIcon={<Send className="w-3.5 h-3.5 text-indigo-600" />}
                    onClick={() => {
                      setTestResult(null);
                      setShowTestModal(true);
                    }}
                  >
                    Send Test Email
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingEmail}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Save Email Configuration
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </div>
        )}

        {/* MODAL: SEND TEST EMAIL */}
        {showTestModal && (
          <Modal
            isOpen={showTestModal}
            onClose={() => setShowTestModal(false)}
            title="SMTP Connection & Email Diagnostic Test"
            subtitle="Verify handshake and dispatch a live test message through your company mail server"
            maxWidth="md"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowTestModal(false)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isTestingEmail}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                  onClick={handleSendTestEmail}
                >
                  Execute Diagnostic Test
                </Button>
              </div>
            }
          >
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Recipient Test Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="Enter recipient email e.g. himanshu.m@letsunbound.com"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  A verification email will be dispatched to this address to confirm end-to-end routing.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px] text-slate-600">
                <div><strong>Server Host:</strong> {emailConfig.host || '<not set>'}</div>
                <div><strong>Port & Protocol:</strong> {emailConfig.port} ({emailConfig.security})</div>
                <div><strong>Sender Header:</strong> {emailConfig.fromEmail}</div>
              </div>

              {testResult && (
                <Alert
                  variant={testResult.success ? 'success' : 'danger'}
                  title={testResult.success ? 'Connection & Delivery Succeeded' : 'SMTP Test Failed'}
                  message={testResult.message}
                />
              )}
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}
