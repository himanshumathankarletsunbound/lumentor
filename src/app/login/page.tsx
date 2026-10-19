'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import {
  ShieldCheck,
  Calendar,
  GraduationCap,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Building2,
  CheckCircle2,
  Sparkles,
  Layers,
  Zap,
  Shield,
  Briefcase,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, availableUsers } = useAuth();

  const [selectedRole, setSelectedRole] = useState<'ADMINISTRATOR' | 'OPERATIONS' | 'MENTOR'>('ADMINISTRATOR');
  const [email, setEmail] = useState('admin@lumentor.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminUser = availableUsers.find((u) => u.role === 'ADMINISTRATOR') || availableUsers[0];
  const opsUser = availableUsers.find((u) => u.role === 'OPERATIONS') || availableUsers[1];
  const mentorUser = availableUsers.find((u) => u.role === 'MENTOR') || availableUsers[2];

  const handleRoleTabClick = (role: 'ADMINISTRATOR' | 'OPERATIONS' | 'MENTOR') => {
    setSelectedRole(role);
    setError(null);
    if (role === 'ADMINISTRATOR') {
      setEmail(adminUser.email);
    } else if (role === 'OPERATIONS') {
      setEmail(opsUser.email);
    } else {
      setEmail(mentorUser.email);
    }
  };

  const handleQuickLogin = async (targetRole: 'ADMINISTRATOR' | 'OPERATIONS' | 'MENTOR') => {
    setIsLoading(true);
    setError(null);
    let targetEmail = adminUser.email;
    let targetPath = '/overview/executive';

    if (targetRole === 'OPERATIONS') {
      targetEmail = opsUser.email;
      targetPath = '/overview/operations';
    } else if (targetRole === 'MENTOR') {
      targetEmail = mentorUser.email;
      targetPath = '/overview/mentor';
    }

    try {
      const res = await login(targetEmail);
      if (res.success) {
        router.push(targetPath);
      } else {
        setError(res.error || 'Authentication failed');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide an email address.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await login(email, password);
    if (res.success && res.user) {
      if (res.user.role === 'ADMINISTRATOR') router.push('/overview/executive');
      else if (res.user.role === 'OPERATIONS') router.push('/overview/operations');
      else if (res.user.role === 'MENTOR') router.push('/overview/mentor');
      else router.push('/');
    } else {
      setError(res.error || 'Could not authenticate with provided credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-portal-mesh flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden text-slate-100">
      {/* Ambient Lighting Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-10 right-10 w-96 h-96 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-semibold text-indigo-300 mb-5 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Classcard v2 Public API Sync Gateway Active</span>
        </div>

        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-xl shadow-indigo-600/40">
            <Layers className="w-6 h-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            LUmentor
          </h1>
        </div>
        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          Operational scheduling, multi-model faculty compensation, and live Classcard attendance management.
        </p>
      </div>

      {/* Main Authentication Container */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="glass-panel-dark rounded-3xl shadow-2xl p-6 sm:p-9 border border-slate-700/80">
          {error && (
            <div className="mb-6">
              <Alert type="error" title="Authentication Notice" message={error} />
            </div>
          )}

          {/* Role Selection Tabs */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Select Your Role Portal
              </span>
              <span className="text-[11px] text-slate-400 font-medium">1-Click Instant Access</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Administrator Role Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleRoleTabClick('ADMINISTRATOR')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRoleTabClick('ADMINISTRATOR');
                  }
                }}
                className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer select-none ${
                  selectedRole === 'ADMINISTRATOR'
                    ? 'bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-900/40'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Admin
                  </span>
                </div>
                <p className="font-bold text-slate-100 text-xs sm:text-sm">
                  Executive Admin
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Full control & payroll
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-indigo-400 font-medium">{adminUser.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickLogin('ADMINISTRATOR');
                    }}
                    className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-2 py-0.8 rounded-md transition-colors"
                  >
                    Enter →
                  </button>
                </div>
              </div>

              {/* Operations Specialist Role Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleRoleTabClick('OPERATIONS')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRoleTabClick('OPERATIONS');
                  }
                }}
                className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer select-none ${
                  selectedRole === 'OPERATIONS'
                    ? 'bg-sky-950/60 border-sky-500 shadow-lg shadow-sky-900/40'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Operations
                  </span>
                </div>
                <p className="font-bold text-slate-100 text-xs sm:text-sm">
                  Operations Desk
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Calendar & attendance
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-sky-400 font-medium">{opsUser.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickLogin('OPERATIONS');
                    }}
                    className="text-[10px] font-bold text-white bg-sky-600 hover:bg-sky-500 px-2 py-0.8 rounded-md transition-colors"
                  >
                    Enter →
                  </button>
                </div>
              </div>

              {/* Faculty Mentor Role Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleRoleTabClick('MENTOR')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRoleTabClick('MENTOR');
                  }
                }}
                className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer select-none ${
                  selectedRole === 'MENTOR'
                    ? 'bg-emerald-950/60 border-emerald-500 shadow-lg shadow-emerald-900/40'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Faculty
                  </span>
                </div>
                <p className="font-bold text-slate-100 text-xs sm:text-sm">
                  Mentor Hub
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Classes & payslips
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 font-medium">{mentorUser.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickLogin('MENTOR');
                    }}
                    className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-2 py-0.8 rounded-md transition-colors"
                  >
                    Enter →
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/80" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0f172a] px-3 text-slate-400 font-bold tracking-wider">
                Or Sign In With Account Credentials
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@lumentor.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium">
                  Forgot credentials?
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-xs text-slate-300">
                  Keep me signed in for 30 days
                </span>
              </label>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>256-Bit SSL Enforced</span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isLoading}
                className="w-full justify-center text-sm font-semibold shadow-lg shadow-indigo-600/30 py-3"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isLoading ? 'Authenticating Session...' : `Sign In as ${selectedRole.toLowerCase()}`}
              </Button>
            </div>
          </form>

          {/* Footer Security Badges */}
          <div className="mt-8 pt-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Connected to Classcard Public API v2 (Production)</span>
            </div>
            <div className="text-slate-500 text-[11px]">
              LUmentor Enterprise RBAC Engine
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
