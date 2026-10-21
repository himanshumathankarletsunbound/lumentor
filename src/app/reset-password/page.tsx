'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const { resetPassword } = useAuth();

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Password reset token is required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify and re-enter.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await resetPassword(token.trim(), newPassword);
    setIsLoading(false);

    if (res.success) {
      setIsSuccess(true);
    } else {
      setError(res.error || 'Failed to reset password. The link may have expired.');
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 sm:px-9">
      {error && (
        <div className="mb-5">
          <Alert variant="danger" title="Reset Failed">
            {error}
          </Alert>
        </div>
      )}

      {isSuccess ? (
        <div className="space-y-5 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Password Successfully Updated
            </h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Your institutional password has been securely reset. You can now sign in with your new password.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-600/30"
          >
            Sign In with New Password
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!initialToken && (
            <div>
              <label
                htmlFor="token"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Reset Authorization Token
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from reset email/link"
                className="block w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              New Password (min. 8 characters)
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                className="block w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Confirm New Password
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="block w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 text-white font-medium"
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Update Password & Encrypt
          </Button>

          <div className="pt-4 text-center border-t border-slate-800">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to login
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-600/25 ring-1 ring-white/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-white">
              LU<span className="text-indigo-400">mentor</span>
            </span>
            <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Account Security
            </span>
          </div>
        </div>

        <h2 className="mt-4 text-center text-xl font-bold tracking-tight text-white">
          Create New Password
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Ensure your password is at least 8 characters and contains mixed characters.
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <Suspense
          fallback={
            <div className="bg-slate-900/90 py-8 px-6 text-center text-slate-400 text-xs">
              Loading password reset form...
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
