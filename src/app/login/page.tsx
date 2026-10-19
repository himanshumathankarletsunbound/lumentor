'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
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
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, availableUsers } = useAuth();

  const [email, setEmail] = useState('admin@academyapex.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminUser = availableUsers.find((u) => u.role === 'ADMINISTRATOR') || availableUsers[0];
  const opsUser = availableUsers.find((u) => u.role === 'OPERATIONS') || availableUsers[1];
  const mentorUser = availableUsers.find((u) => u.role === 'MENTOR') || availableUsers[2];

  const handlePersonaSelect = async (selectedEmail: string, destination: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await login(selectedEmail);
      if (res.success) {
        router.push(destination);
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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center relative z-10">
        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-indigo-300 mb-6 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Classcard Public API v2 Operations & Payroll</span>
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          Apex Management Portal
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
          Unified scheduling, multi-model mentor payroll, attendance tracking, and Classcard synchronization.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="bg-slate-800/90 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8">
          {error && (
            <div className="mb-6">
              <Alert type="error" title="Sign In Error" message={error} />
            </div>
          )}

          {/* Quick Persona Sign-in Options */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1-Click Role-Based Quick Access
              </span>
              <span className="text-[11px] text-slate-500">Instant Demo Login</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Administrator */}
              <button
                type="button"
                onClick={() => handlePersonaSelect(adminUser.email, '/overview/executive')}
                disabled={isLoading}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/70 hover:border-indigo-500/80 hover:bg-slate-900 transition-all text-left group focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <Badge variant="purple" size="sm">Admin</Badge>
                </div>
                <p className="font-bold text-slate-200 text-xs group-hover:text-white transition-colors">
                  {adminUser.name}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Full config & payroll lock
                </p>
              </button>

              {/* Operations Specialist */}
              <button
                type="button"
                onClick={() => handlePersonaSelect(opsUser.email, '/overview/operations')}
                disabled={isLoading}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/70 hover:border-sky-500/80 hover:bg-slate-900 transition-all text-left group focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition-colors">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <Badge variant="info" size="sm">Operations</Badge>
                </div>
                <p className="font-bold text-slate-200 text-xs group-hover:text-white transition-colors">
                  {opsUser.name}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  Calendar & attendance
                </p>
              </button>

              {/* Mentor / Faculty */}
              <button
                type="button"
                onClick={() => handlePersonaSelect(mentorUser.email, '/overview/mentor')}
                disabled={isLoading}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/70 hover:border-emerald-500/80 hover:bg-slate-900 transition-all text-left group focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <Badge variant="success" size="sm">Mentor</Badge>
                </div>
                <p className="font-bold text-slate-200 text-xs group-hover:text-white transition-colors">
                  {mentorUser.name}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  My classes & payslips
                </p>
              </button>
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-800 px-3 text-slate-400 font-semibold tracking-wider">
                Or Sign In With Account
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@academyapex.com"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <span className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-10 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-300">
                  Remember this device for 30 days
                </label>
              </div>

              <span className="text-[11px] text-slate-500">
                SSL 256-Bit Encrypted
              </span>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isLoading}
                className="w-full justify-center text-sm font-semibold shadow-lg shadow-indigo-600/30"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isLoading ? 'Authenticating...' : 'Sign In to Portal'}
              </Button>
            </div>
          </form>

          {/* Footer Demo Info */}
          <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
            <p className="text-xs text-slate-400">
              Connected to <strong className="text-slate-200">Classcard Public API v2</strong> sandbox gateway.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
