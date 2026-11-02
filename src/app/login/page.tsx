'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const thoughtOfTheDay = 'Small, consistent improvements create exceptional learning experiences.';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError('Please provide an email or username.');
      return;
    }
    if (!password) {
      setError('Please provide your password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    const response = await login(email, password, rememberMe);
    if (response.success && response.user) {
      if (response.user.role === 'ADMINISTRATOR') router.push('/overview/executive');
      else if (response.user.role === 'OPERATIONS') router.push('/overview/operations');
      else if (response.user.role === 'MENTOR') router.push('/overview/mentor');
      else router.push('/');
    } else {
      setError(response.error || 'Invalid email or password. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f9fc] p-3 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden overflow-hidden bg-[#172554] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-36 -left-20 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:42px_42px]" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/25 backdrop-blur">
                <ShieldCheck className="h-6 w-6 text-cyan-200" />
              </div>
              <div>
                <p className="text-xl font-black tracking-tight">LU<span className="text-cyan-200">mentor</span></p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-200">Lets Unbound</p>
              </div>
            </div>
            <div className="mt-24 max-w-md">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">One workspace. Better outcomes.</p>
              <h1 className="text-4xl font-bold leading-tight xl:text-5xl">Everything your learning team needs to move forward.</h1>
              <p className="mt-6 max-w-sm text-base leading-7 text-blue-100">
                Coordinate mentors, classes, attendance, performance, and payroll from one secure operational workspace.
              </p>
            </div>
          </div>

          <div className="relative z-10 grid gap-3 text-sm text-blue-100 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {['Clear operational visibility', 'Secure role-based access', 'Built for growing teams'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-200" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-12 lg:px-16 xl:px-24">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xl font-black tracking-tight">LU<span className="text-indigo-600">mentor</span></p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Lets Unbound</p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold text-indigo-600">Welcome to Lets Unbound</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-950">Sign in to your workspace</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Use your Lets Unbound username or email to continue.</p>
            </div>

            {error && <div className="mb-5"><Alert variant="danger" title="Authentication Error">{error}</Alert></div>}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Username or email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input id="email" type="text" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@letsunbound.com" className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700">Password</label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">Forgot password?</Link>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input id="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />
                  <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Remember me for 30 days
              </label>

              <Button type="submit" variant="primary" className="w-full justify-center rounded-xl bg-indigo-600 py-3 font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500" isLoading={isLoading} rightIcon={<ArrowRight className="h-4 w-4" />}>
                Sign in
              </Button>
            </form>

            <div className="mt-7 border-t border-slate-100 pt-6 text-center">
              <p className="text-sm text-slate-500">New to Lets Unbound? <a href="mailto:admin@letsunbound.com?subject=Lets%20Unbound%20access%20request" className="font-semibold text-indigo-600 hover:text-indigo-500">Register</a></p>
              <div className="mt-7 rounded-2xl bg-amber-50 px-4 py-4 text-left ring-1 ring-amber-100">
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Thought of the day</p>
                    <p className="mt-1 text-sm leading-5 text-amber-900/80">“{thoughtOfTheDay}”</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
