'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';

const QUOTES = [
  'Small improvements, repeated consistently, create remarkable results.',
  'Clarity in every review creates confidence in every decision.',
  'Great teams turn reliable work into measurable progress.',
  'Today is a good day to make the next useful improvement.',
];

export function WelcomeHeader({ subtitle }: { subtitle?: string }) {
  const { currentUser } = useAuth();
  const [now, setNow] = useState<Date | null>(null);
  const quote = useMemo(() => QUOTES[(now?.getDate() || 1) % QUOTES.length], [now]);
  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    // The initial client-side timestamp starts the live clock after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-indigo-600">{greeting}, {currentUser.name || 'there'}.</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Welcome to LUmentor</h1>
        <p className="mt-2 text-sm italic text-slate-500">“{quote}”</p>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white">
        <Clock3 className="h-5 w-5 text-indigo-300" />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Live time</p>
          <p className="font-mono text-xl font-semibold tabular-nums">
            {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
          </p>
        </div>
      </div>
    </div>
  );
}
