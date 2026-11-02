'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, Crown, Medal, TrendingUp } from 'lucide-react';
import { AppShell } from '../../../../components/layout/AppShell';
import { WelcomeHeader } from '../../../../components/dashboard/WelcomeHeader';
import { Card, CardContent, CardHeader } from '../../../../components/ui/Card';
import { StatCard } from '../../../../components/ui/StatCard';
import { Alert } from '../../../../components/ui/Alert';
import { useAuth } from '../../../../lib/auth/AuthContext';

type Review = {
  mentorId: string;
  mentorName: string;
  reviewPeriod: string;
  totalScore: number | null;
};

const periodLabel = (period: string) => new Date(`${period}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const previousPeriod = () => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
};

export default function MentorRatingPage() {
  const { currentUser } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [leaderboard, setLeaderboard] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastMonth, setLastMonth] = useState('');

  useEffect(() => {
    if (!currentUser.mentorId) return;
    const reviewPeriod = previousPeriod();
    fetch('/api/mentor-reviews?all=true')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load your ratings.');
        setLastMonth(reviewPeriod);
        setReviews(data.reviews || []);
        setLeaderboard(data.leaderboard || []);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load your ratings.'));
  }, [currentUser.mentorId]);

  const monthly = useMemo(() => {
    const grouped = new Map<string, Review>();
    reviews.forEach((review) => grouped.set(review.reviewPeriod, review));
    return [...grouped.values()].sort((a, b) => a.reviewPeriod.localeCompare(b.reviewPeriod));
  }, [reviews]);
  const lastMonthReview = reviews.find((review) => review.reviewPeriod === lastMonth);
  const ranking = useMemo(() => {
    const rows = leaderboard
      .filter((review) => review.reviewPeriod === lastMonth && review.totalScore !== null)
      .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
    return { rows, rank: rows.findIndex((review) => review.mentorId === currentUser.mentorId) + 1 };
  }, [currentUser.mentorId, lastMonth, leaderboard]);
  const highest = reviews.reduce((best, review) => Math.max(best, review.totalScore ?? 0), 0);
  const streak = useMemo(() => {
    const periods = [...new Set(leaderboard.map((review) => review.reviewPeriod))].sort().reverse();
    let count = 0;
    for (const period of periods) {
      const rows = leaderboard.filter((review) => review.reviewPeriod === period && review.totalScore !== null).sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
      if (rows[0]?.mentorId !== currentUser.mentorId) break;
      count += 1;
    }
    return count;
  }, [currentUser.mentorId, leaderboard]);
  const maxScore = 5;

  return (
    <AppShell>
      <div className="space-y-6">
        <WelcomeHeader subtitle="Mentor workspace · Your monthly review performance and ranking." />
        {error && <Alert type="error" title="Unable to load ratings" message={error} />}
        <div>
          <h1 className="text-xl font-bold text-slate-900">My rating</h1>
          <p className="mt-1 text-sm text-slate-500">Track your monthly review score, ranking, and progress.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard title="Last month rating" value={lastMonthReview?.totalScore ?? '—'} subtitle={periodLabel(lastMonth)} icon={<TrendingUp className="h-5 w-5" />} color="indigo" />
          <StatCard title="Last month rank" value={ranking.rank || '—'} subtitle="Among reviewed mentors" icon={<Award className="h-5 w-5" />} color="amber" />
          <StatCard title="Highest rating achieved" value={highest || '—'} subtitle="Out of 5 points" icon={<Crown className="h-5 w-5" />} color="emerald" />
          <StatCard title="Top rank streak" value={`${streak} ${streak === 1 ? 'month' : 'months'}`} subtitle="Consecutive #1 finishes" icon={<Medal className="h-5 w-5" />} color="sky" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <Card className="lg:order-last">
            <CardHeader title="Monthly rating trend" subtitle="Your submitted review score out of 5 points." />
            <CardContent>
              {monthly.length === 0 ? <p className="text-sm text-slate-500">Your monthly ratings will appear here after the Audit Team submits a review.</p> : (
                <div className="space-y-4">
                  {monthly.map((review) => (
                    <div key={review.reviewPeriod} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs font-medium text-slate-500">{periodLabel(review.reviewPeriod)}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(((review.totalScore ?? 0) / maxScore) * 100, 100)}%` }} /></div>
                      <span className="w-10 text-right text-sm font-bold text-slate-900">{review.totalScore ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="lg:order-first">
            <CardHeader title="Top rankers" subtitle={lastMonth ? periodLabel(lastMonth) : 'Loading period'} />
            <CardContent className="space-y-3">
              {ranking.rows.slice(0, 3).map((review, index) => (
                <div key={review.mentorId} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <span className="text-xl">{['🥇', '🥈', '🥉'][index]}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{review.mentorName}</p><p className="text-xs text-slate-500">Rank {index + 1}</p></div>
                  <span className="font-bold text-indigo-700">{review.totalScore}/5</span>
                </div>
              ))}
              {ranking.rows.length === 0 && <p className="text-sm text-slate-500">No reviewed mentors for last month yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
