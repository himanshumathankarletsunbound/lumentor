'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
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

function AuditDashboardContent() {
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState(currentPeriod);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [scores, setScores] = useState<Record<string, { auditScore: string; operationScore: string; comments: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const requestedMode = searchParams.get('mode');
  const mode: 'dashboard' | 'post' | 'analyze' = requestedMode === 'analyze' ? 'analyze' : requestedMode === 'post' ? 'post' : 'dashboard';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, allResponse] = await Promise.all([
        fetch(`/api/mentor-reviews?period=${encodeURIComponent(period)}`),
        fetch('/api/mentor-reviews?all=true'),
      ]);
      const data = await response.json();
      const allData = await allResponse.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load mentor reviews.');
      if (!allResponse.ok || !allData.success) throw new Error(allData.error || 'Failed to load review analytics.');
      setMentors(data.mentors || []);
      setReviews(data.reviews || []);
      setAllReviews(allData.reviews || []);
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
  const monthlyAnalysis = useMemo(() => {
    const grouped = new Map<string, { audit: number; operations: number; total: number; count: number }>();
    allReviews.forEach((review) => {
      const current = grouped.get(review.reviewPeriod) || { audit: 0, operations: 0, total: 0, count: 0 };
      if (review.auditScore !== null) current.audit += review.auditScore;
      if (review.operationScore !== null) current.operations += review.operationScore;
      if (review.totalScore !== null) current.total += review.totalScore;
      current.count += 1;
      grouped.set(review.reviewPeriod, current);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({
      month,
      audit: values.count ? values.audit / values.count : 0,
      operations: values.count ? values.operations / values.count : 0,
      total: values.count ? values.total / values.count : 0,
      count: values.count,
    }));
  }, [allReviews]);
  const previousPeriod = useMemo(() => {
    const date = new Date(`${period}-01T00:00:00`);
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 7);
  }, [period]);
  const topPerformers = useMemo(() => (reviewPeriod: string) => allReviews
    .filter((review) => review.reviewPeriod === reviewPeriod && review.totalScore !== null)
    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
    .slice(0, 5), [allReviews]);

  const saveScore = async (mentorId: string) => {
    const existingReview = reviewByMentor.get(mentorId);
    const value = scores[mentorId] || {
      auditScore: existingReview?.auditScore?.toString() || '',
      operationScore: existingReview?.operationScore?.toString() || '2',
      comments: '',
    };

    if (!value.auditScore.trim() || !value.operationScore.trim()) {
      setError('Enter both the Audit and Operations scores before submitting.');
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
          auditScore: value.auditScore,
          operationScore: value.operationScore,
          auditComments: value.comments,
          operationComments: value.comments,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save score.');
      setScores((previous) => ({ ...previous, [mentorId]: { auditScore: '', operationScore: '2', comments: '' } }));
      setEditing((previous) => ({ ...previous, [mentorId]: false }));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save score.');
    } finally {
      setSaving(null);
    }
  };

  const downloadTemplate = async () => {
    const response = await fetch('/api/mentor-reviews/template');
    if (!response.ok) { setError('Unable to download the mentor rating template.'); return; }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mentor-rating-template.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  const uploadRatings = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('reviewPeriod', period);
      const response = await fetch('/api/mentor-reviews', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to submit ratings.');
      setScores((previous) => {
        const next = { ...previous };
        for (const rating of data.ratings || []) next[rating.mentorId] = { auditScore: String(rating.auditScore), operationScore: String(rating.operationScore), comments: rating.comments || '' };
        return next;
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to submit ratings.');
    } finally {
      setUploading(false);
    }
  };

  const submitAll = async () => {
    const ratings = mentors.map((mentor) => {
      const existing = reviewByMentor.get(mentor.id);
      const input = scores[mentor.id];
      return { mentorId: mentor.id, auditScore: input?.auditScore || existing?.auditScore, operationScore: input?.operationScore || existing?.operationScore || 2, comments: input?.comments || existing?.auditComments || '' };
    }).filter((rating) => rating.auditScore !== undefined && rating.auditScore !== '');
    if (!ratings.length) { setError('Enter at least one rating before submitting.'); return; }
    setUploading(true);
    setError(null);
    try {
      const response = await fetch('/api/mentor-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewPeriod: period, ratings }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to submit ratings.');
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit ratings.');
    } finally {
      setUploading(false);
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
        {mode === 'dashboard' && <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Active mentors', mentors.length, 'Current active roster'],
              ['Current month reviews', reviews.length, `${period} ratings submitted`],
              ['Pending current ratings', pendingReviews, 'Mentors still awaiting review'],
              ['Historical reviews', allReviews.length, 'All submitted review records'],
            ].map(([label, value, detail]) => <Card key={String(label)}><CardContent><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></CardContent></Card>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {[['Top performers · current month', period], ['Top performers · previous month', previousPeriod]].map(([title, reviewPeriod]) => <Card key={String(title)}>
              <CardHeader title={String(title)} subtitle={String(reviewPeriod)} />
              <CardContent>{topPerformers(String(reviewPeriod)).length ? <div className="space-y-3">{topPerformers(String(reviewPeriod)).map((review, index) => <div key={review.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3"><div><p className="font-semibold text-slate-900">{index + 1}. {review.mentorName}</p><p className="text-xs text-slate-500">{review.branchName}</p></div><p className="font-bold text-indigo-700">{review.totalScore} / 5</p></div>)}</div> : <p className="py-6 text-center text-sm text-slate-500">No completed ratings for {reviewPeriod}.</p>}</CardContent>
            </Card>)}
          </div>
        </>}
        {mode === 'post' && <Card>
          <CardHeader title="Post mentor ratings" subtitle={`Upload audit ratings for ${period}. Operations points default to 2.`} />
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void downloadTemplate()}>Download Excel template</Button>
              <label className="inline-flex cursor-pointer items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                {uploading ? 'Submitting ratings...' : 'Upload Excel or CSV'}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={uploading} onChange={(event) => void uploadRatings(event)} />
              </label>
              <Button variant="primary" onClick={() => void submitAll()} disabled={uploading}>Submit all</Button>
            </div>
            <p className="mt-4 text-xs text-slate-500">The template includes every active mentor ID and name. Enter the Audit Rating (0–3) and an optional Remark, then upload it. Ratings are validated and submitted for the selected period.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Active mentors</p><p className="text-2xl font-bold">{mentors.length}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Ratings already submitted</p><p className="text-2xl font-bold">{auditCompleted}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Still to rate</p><p className="text-2xl font-bold">{Math.max(mentors.length - auditCompleted, 0)}</p></div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-2">Mentor</th><th className="px-3 py-2">Audit / 3</th><th className="px-3 py-2">Operations / 2</th><th className="px-3 py-2">Review</th><th className="px-3 py-2"></th></tr></thead>
                <tbody>{mentors.map((mentor) => {
                  const review = reviewByMentor.get(mentor.id);
                  const input = scores[mentor.id] || { auditScore: review?.auditScore?.toString() || '', operationScore: '2', comments: '' };
                  return <tr key={mentor.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium">{mentor.firstName} {mentor.lastName}<span className="ml-2 text-xs text-slate-400">{mentor.id}</span></td>
                    {review && !editing[mentor.id] ? <><td className="px-3 py-3 font-semibold">{review.auditScore}</td><td className="px-3 py-3 font-semibold">{review.operationScore}</td><td className="px-3 py-3 text-slate-600">{review.auditComments || '—'}</td><td className="px-3 py-3"><Button variant="ghost" size="sm" onClick={() => setEditing((previous) => ({ ...previous, [mentor.id]: true }))} leftIcon={<Pencil className="h-4 w-4" />}>Edit</Button></td></> : <><td className="px-3 py-3"><input type="number" min="0" max="3" step="0.01" value={input.auditScore} onChange={(event) => setScores((previous) => ({ ...previous, [mentor.id]: { ...input, auditScore: event.target.value } }))} className="w-24 rounded border border-slate-300 px-2 py-1.5" /></td><td className="px-3 py-3"><input type="number" min="0" max="2" step="0.01" value={input.operationScore} onChange={(event) => setScores((previous) => ({ ...previous, [mentor.id]: { ...input, operationScore: event.target.value } }))} className="w-24 rounded border border-slate-300 px-2 py-1.5" /></td><td className="px-3 py-3"><input value={input.comments} onChange={(event) => setScores((previous) => ({ ...previous, [mentor.id]: { ...input, comments: event.target.value } }))} placeholder="Write review" className="w-full min-w-48 rounded border border-slate-300 px-2 py-1.5" /></td><td className="px-3 py-3"><Button size="sm" onClick={() => void saveScore(mentor.id)} disabled={saving === mentor.id}>{saving === mentor.id ? 'Saving' : 'Save'}</Button></td></>}
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>}
        {mode === 'analyze' && <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Mentors to review', mentors.length, 'All active mentors in this period'],
            ['Reviews completed', completedReviews, 'Both scores submitted'],
            ['Audit completed', auditCompleted, 'Audit score submitted'],
            ['Operations completed', operationsCompleted, 'Operations score submitted'],
            ['Still pending', pendingReviews, 'Needs final review'],
          ].map(([label, value, detail]) => <Card key={String(label)}><CardContent><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></CardContent></Card>)}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">All-month reviews</p><p className="mt-2 text-3xl font-bold text-slate-900">{allReviews.length}</p><p className="mt-1 text-xs text-slate-400">Historical ratings recorded</p></CardContent></Card>
          <Card><CardContent><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historical average</p><p className="mt-2 text-3xl font-bold text-indigo-700">{allReviews.length ? (allReviews.reduce((sum, review) => sum + (review.totalScore || 0), 0) / allReviews.filter((review) => review.totalScore !== null).length || 0).toFixed(2) : '0.00'} / 5</p><p className="mt-1 text-xs text-slate-400">Average final score</p></CardContent></Card>
          <Card><CardContent><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Months analyzed</p><p className="mt-2 text-3xl font-bold text-emerald-700">{monthlyAnalysis.length}</p><p className="mt-1 text-xs text-slate-400">Available review periods</p></CardContent></Card>
        </div>
        <Card>
          <CardHeader title="Monthly rating trend" subtitle="Average Audit, Operations, and total scores across all submitted months." />
          <CardContent>
            {monthlyAnalysis.length === 0 ? <p className="py-8 text-center text-slate-500">No historical ratings available.</p> : <div className="space-y-4">{monthlyAnalysis.map((item) => <div key={item.month}><div className="mb-1 flex justify-between text-xs font-semibold text-slate-600"><span>{item.month} · {item.count} ratings</span><span>{item.total.toFixed(2)} / 5 total</span></div><div className="flex h-3 gap-1 overflow-hidden rounded-full bg-slate-100"><div className="bg-indigo-500" style={{ width: `${(item.audit / 3) * 50}%` }} title={`Audit ${item.audit.toFixed(2)} / 3`} /><div className="bg-amber-400" style={{ width: `${(item.operations / 2) * 25}%` }} title={`Operations ${item.operations.toFixed(2)} / 2`} /><div className="bg-emerald-500" style={{ width: `${(item.total / 5) * 25}%` }} title={`Total ${item.total.toFixed(2)} / 5`} /></div></div>)}</div>}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-500" />Audit / 3</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Operations / 2</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Total / 5</span></div>
          </CardContent>
        </Card>
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
                      return <tr key={mentor.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-4 font-semibold">{review?.totalScore === null || review?.totalScore === undefined ? '—' : index + 1}</td>
                        <td className="px-3 py-4 font-medium">{mentor.firstName} {mentor.lastName}</td>
                        <td className="px-3 py-4 text-slate-500">{mentor.branchName || '—'}</td>
                        <td className="px-3 py-4">{review?.auditScore ?? '—'}</td>
                        <td className="px-3 py-4">{review?.operationScore ?? '—'}</td>
                        <td className="px-3 py-4 font-bold text-indigo-700">{review?.totalScore ?? 'Pending'}</td>
                        <td className="px-3 py-4 text-slate-500">{review?.auditComments || review?.operationComments || '—'}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        </>}
      </div>
    </AppShell>
  );
}

export default function AuditDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading audit workspace...</div>}>
      <AuditDashboardContent />
    </Suspense>
  );
}
