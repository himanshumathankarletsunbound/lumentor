'use client';

import { FormEvent, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { useAuth } from '../../../lib/auth/AuthContext';

export default function SupportTicketsPage() {
  const [submitted, setSubmitted] = useState(false);
  const { currentUser } = useAuth();

  const submitTicket = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = String(form.get('subject') || '').trim();
    const description = String(form.get('description') || '').trim();
    const body = `${description}\n\nSubmitted by: ${currentUser.name} <${currentUser.email}>`;
    window.location.href = `mailto:support@letsunbound.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  };

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Support ticket</h1>
          <p className="mt-1 text-sm text-slate-500">Tell the LUmentor team what you need help with.</p>
        </div>
        <Card>
          <CardHeader title="Open a request" subtitle="Include enough detail for the team to investigate quickly." />
          <CardContent>
            {submitted ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Your email client is ready to send this request to the support team.
              </p>
            ) : (
              <form className="space-y-4" onSubmit={submitTicket}>
                <label className="block text-sm font-medium text-slate-700">
                  Subject
                  <input required name="subject" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Description
                  <textarea required name="description" rows={6} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <Button type="submit" variant="primary">Submit ticket</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
