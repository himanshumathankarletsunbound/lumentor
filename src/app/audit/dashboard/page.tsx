'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../lib/auth/AuthContext';
import { WelcomeHeader } from '../../../components/dashboard/WelcomeHeader';

type Mentor = { id: string; firstName: string; lastName: string; branchName?: string; status: string };
type Review = {
  id: string;
  mentorId: string;
  mentorName: string;
  branchName: string;
  reviewPeriod: string;
  auditScore: number | null;
  operationScore: number | null;
  totalScore: number | null;
  auditComments: string | null;
  operationComments: string | null;
};

const currentPeriod = new Date().toISOString().slice(0, 7);

export default function AuditDashboardPage() {
  const { currentUser } = useAuth();
  const [period, setPeriod] = useState(currentPeriod);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [scores, setScores] = useState<Record<string, { score: string; comments: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAudit = currentUser.role === 'AUDIT';
  const isOperations = currentUser.role === 'OPERATIONS';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/mentor-reviews?period=${encodeURIComponent(period)}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load mentor reviews.');
      setMentors(data.mentors || []);
      setReviews(data.reviews || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load mentor reviews.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    // Fetch the selected period whenever the user changes it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const reviewByMentor = useMemo(() => new Map(reviews.map((review) => [review.mentorId, review])), [reviews]);
  const completedReviews = reviews.filter((review) => review.totalScore !== null).length;
  const auditCompleted = reviews.filter((review) => review.auditScore !== null).length;
  const operationsCompleted = reviews.filter((review) => review.operationScore !== null).length;
  const pendingReviews = Math.max(mentors.length - completedReviews, 0);
  const rankedMentors = useMemo(() => [...mentors].sort((a, b) => {
    const scoreA = reviewByMentor.get(a.id)?.totalScore ?? -1;
    const scoreB = reviewByMentor.get(b.id)?.totalScore ?? -1;
    return scoreB - scoreA || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  }), [mentors, reviewByMentor]);

  const saveScore = async (mentorId: string) => {
    const value = scores[mentorId] || { score: '', comments: '' };
    if (!value.score.trim()) {
      setError('Enter a score before saving.');
      return;
    }
    setSaving(mentorId);
    setError(null);
    try {
      const response = await fetch('/api/mentor-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentorId,
          reviewPeriod: period,
          ...(isAudit ? { auditScore: value.score, auditComments: value.comments } : { operationScore: value.score, operationComments: value.comments }),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save score.');
      setScores((previous) => ({ ...previous, [mentorId]: { score: '', comments: '' } }));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save score.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <WelcomeHeader subtitle="Audit workspace · Audit scores out of 3 and Operations scores out of 2." />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-medium text-amber-600">Audit workspace</p><h2 className="text-xl font-bold text-slate-900">Mentor review progress</h2></div>
          <label className="text-sm font-medium text-slate-700">Review period<input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" /></label>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Mentors to review', mentors.length, 'All active mentors in this period'],
            ['Reviews completed', completedReviews, 'Both scores submitted'],
            ['Audit completed', auditCompleted, 'Audit score submitted'],
            ['Operations completed', operationsCompleted, 'Operations score submitted'],
            ['Still pending', pendingReviews, 'Needs final review'],
          ].map(([label, value, detail]) => <Card key={String(label)}><CardContent><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></CardContent></Card>)}
        </div>
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Mentor ranking</h2>
          </CardHeader>
          <CardContent>
            {loading ? <p className="py-8 text-center text-slate-500">Loading mentors...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-3">Rank</th><th className="px-3 py-3">Mentor</th><th className="px-3 py-3">Branch</th><th className="px-3 py-3">Audit / 3</th><th className="px-3 py-3">Operations / 2</th><th className="px-3 py-3">Total / 5</th><th className="px-3 py-3">Review</th></tr></thead>
                  <tbody>
                    {rankedMentors.map((mentor, index) => {
                      const review = reviewByMentor.get(mentor.id);
                      const input = scores[mentor.id] || { score: '', comments: '' };
                      return <tr key={mentor.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-4 font-semibold">{review?.totalScore === null || review?.totalScore === undefined ? '—' : index + 1}</td>
                        <td className="px-3 py-4 font-medium">{mentor.firstName} {mentor.lastName}</td>
                        <td className="px-3 py-4 text-slate-500">{mentor.branchName || '—'}</td>
                        <td className="px-3 py-4">{review?.auditScore ?? '—'}</td>
                        <td className="px-3 py-4">{review?.operationScore ?? '—'}</td>
                        <td className="px-3 py-4 font-bold text-indigo-700">{review?.totalScore ?? 'Pending'}</td>
                        <td className="min-w-[260px] px-3 py-3">
                          {(isAudit || isOperations || currentUser.role === 'ADMINISTRATOR') ? <div className="flex gap-2">
                            <div className="flex-1 space-y-2">
                              <input type="number" min="0" max={isAudit ? 3 : 2} step="0.01" value={input.score} onChange={(event) => setScores((previous) => ({ ...previous, [mentor.id]: { ...input, score: event.target.value } }))} placeholder={isAudit ? '0–3' : '0–2'} className="w-full rounded border border-slate-300 px-2 py-1.5" />
                              <input value={input.comments} onChange={(event) => setScores((previous) => ({ ...previous, [mentor.id]: { ...input, comments: event.target.value } }))} placeholder="Comments (optional)" className="w-full rounded border border-slate-300 px-2 py-1.5" />
                            </div>
                            <Button size="sm" onClick={() => saveScore(mentor.id)} disabled={saving === mentor.id}>{saving === mentor.id ? 'Saving' : 'Save'}</Button>
                          </div> : <span className="text-slate-500">View only</span>}
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
