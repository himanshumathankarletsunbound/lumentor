'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import {
  ShieldCheck,
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ExternalLink,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('himanshu.m@letsunbound.com');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide an email address.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await requestPasswordReset(email);
    setIsLoading(false);

    if (res.success) {
      setIsSubmitted(true);
      if (res.resetUrl) {
        setResetUrl(res.resetUrl);
      }
    } else {
      setError(res.error || 'Unable to generate password reset request.');
    }
  };

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
              Account Recovery
            </span>
          </div>
        </div>

        <h2 className="mt-4 text-center text-xl font-bold tracking-tight text-white">
          Reset Your Password
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Enter your registered email address and we will generate a secure reset link.
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 sm:px-9">
          {error && (
            <div className="mb-5">
              <Alert variant="danger" title="Request Failed">
                {error}
              </Alert>
            </div>
          )}

          {isSubmitted ? (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Reset Token Generated
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  A password reset authorization token has been generated for{' '}
                  <span className="font-semibold text-white">{email}</span>. The token is valid for 60 minutes.
                </p>
              </div>

              {resetUrl && (
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-left space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Direct Reset Link
                  </span>
                  <p className="text-xs font-mono text-indigo-300 break-all select-all">
                    {resetUrl}
                  </p>
                  <Link
                    href={resetUrl}
                    className="inline-flex items-center justify-center gap-1.5 w-full mt-2 py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Open Reset Password Form
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Institutional Email Address
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="himanshu.m@letsunbound.com"
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
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
                Send Password Reset Instructions
              </Button>

              <div className="pt-4 text-center border-t border-slate-800">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
