'use client';

/*
=======================================================================================================================================
Admin Broadcast
=======================================================================================================================================
Purpose: Write a message and send it to every subscribed account, or to one competition's members.

A separate screen from /dashboard/emails, and separate routes behind it, because it is a different
kind of thing. That screen sends an outline email whose recipients AND words both come from the
data - which is what makes a one-click send safe. Here the words are typed, and "all" can mean
every account on the platform, so the screen is built around three things the other one does not
need:

  THE NUMBER, BEFORE THE BUTTON. The audience is counted and shown - after opt-outs, next to the
  raw total - before anything can be sent. "I thought it was going to about thirty people" is a
  plausible and expensive mistake, and it is only preventable in advance.

  A CONFIRMATION THAT CARRIES THE NUMBER. The live send passes back the count the operator was
  looking at, and the server refuses if the audience has moved since. Somebody joining between
  the count and the press is normal; a send larger than the one that was reviewed is not.

  THE SEND CAP, SAID OUT LOUD. Resend allows 100 a day, the platform has more accounts than that,
  so a broadcast to everyone cannot complete in one press. Everyone is queued and the cap is sent
  now; the rest drain later. The screen says how many are waiting rather than implying it is done.

TEST MODE defaults to on at every page load and is not persisted, exactly as on the Emails screen
and for the same reason: a sticky "off" surviving a refresh is how the whole user base gets mailed
by accident.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import {
  adminApi,
  AdminCompetition,
  BroadcastAudience,
  BroadcastAudienceResponse,
  SendBroadcastResponse,
} from '@/lib/api';

export default function BroadcastPage() {
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [competitions, setCompetitions] = useState<AdminCompetition[]>([]);
  const [competitionId, setCompetitionId] = useState<number | null>(null);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Never persisted. See the header note.
  const [testMode, setTestMode] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const [counts, setCounts] = useState<BroadcastAudienceResponse | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendBroadcastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCompetitions = useCallback(async () => {
    try {
      const res = await adminApi.getCompetitions();
      if (res.return_code === 'SUCCESS' && res.competitions) {
        setCompetitions(res.competitions);
        setCompetitionId((current) => current ?? res.competitions?.[0]?.id ?? null);
      }
    } catch {
      setError('Could not load competitions');
    }
  }, []);

  useEffect(() => {
    loadCompetitions();
  }, [loadCompetitions]);

  /*
  Recount whenever the audience changes. The count is the thing the operator is asked to confirm,
  so it must never be left over from a different audience - hence clearing it first rather than
  leaving the old number on screen while the new one loads.
  */
  const loadCount = useCallback(async () => {
    if (audience === 'competition' && !competitionId) return;

    setCountLoading(true);
    setCounts(null);
    setConfirming(false);
    try {
      const res = await adminApi.broadcastAudience(
        audience,
        audience === 'competition' ? competitionId : null
      );
      if (res.return_code === 'SUCCESS') {
        setCounts(res);
        setError(null);
      } else {
        setError(res.message || 'Could not work out the audience');
      }
    } catch {
      setError('Could not work out the audience');
    } finally {
      setCountLoading(false);
    }
  }, [audience, competitionId]);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  // Any edit invalidates a pending confirmation - the operator must re-read what they are sending.
  useEffect(() => {
    setConfirming(false);
  }, [subject, message, testMode]);

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && (counts?.recipient_count ?? 0) > 0;

  const doSend = async () => {
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await adminApi.sendBroadcast({
        audience,
        competitionId: audience === 'competition' ? competitionId : null,
        subject: subject.trim(),
        message: message.trim(),
        testMode,
        confirmCount: testMode ? null : counts?.recipient_count ?? null,
      });

      if (res.return_code === 'SUCCESS') {
        setResult(res);
        setConfirming(false);
        if (!res.test_mode) {
          // A live broadcast is once-only: clear the box so the next press cannot repeat it blind.
          setSubject('');
          setMessage('');
          setTestMode(true);
          loadCount();
        }
      } else {
        setError(res.message || 'Send failed');
        setConfirming(false);
        if (res.return_code === 'COUNT_CHANGED') loadCount();
      }
    } catch {
      setError('Send failed');
    } finally {
      setSending(false);
    }
  };

  const recipientCount = counts?.recipient_count ?? 0;
  const overCap = !testMode && recipientCount > (counts?.send_cap ?? Infinity);

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader title="Broadcast" backHref="/dashboard/emails" />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-600">
          A message from us, to everyone or to one competition. Anyone who has unsubscribed from
          Info is excluded automatically.
        </p>

        {/* Audience */}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Who gets it</h2>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAudience('all')}
              className={`rounded px-3 py-2 text-sm font-medium ${audience === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Everyone
            </button>
            <button
              type="button"
              onClick={() => setAudience('competition')}
              className={`rounded px-3 py-2 text-sm font-medium ${audience === 'competition' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              One competition
            </button>
          </div>

          {audience === 'competition' && (
            <select
              value={competitionId ?? ''}
              onChange={(e) => setCompetitionId(Number(e.target.value))}
              className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div className="mt-4 flex items-center gap-2 rounded bg-slate-50 px-3 py-3 text-sm">
            <UsersIcon className="h-5 w-5 shrink-0 text-slate-500" />
            {countLoading ? (
              <span className="text-slate-500">Counting…</span>
            ) : counts ? (
              <span className="text-slate-800">
                <strong>{recipientCount}</strong> will receive this
                {typeof counts.opted_out_count === 'number' && counts.opted_out_count > 0 && (
                  <span className="text-slate-500">
                    {' '}— {counts.opted_out_count} of {counts.total_count} have unsubscribed
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
            <button type="button" onClick={loadCount} className="ml-auto text-slate-500 hover:text-slate-900" title="Recount">
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>

          {counts?.sample && counts.sample.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              For example: {counts.sample.map((s) => s.display_name).join(', ')}…
            </p>
          )}
        </section>

        {/* Message */}
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Message</h2>

          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            maxLength={200}
            className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message. Blank lines become paragraphs."
            rows={9}
            className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />

          <p className="mt-2 text-xs text-slate-500">
            Plain text only — no HTML or markdown. Every copy is addressed by name and carries an
            unsubscribe link.
          </p>
        </section>

        {/* Send */}
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
            <BeakerIcon className="h-4 w-4 text-slate-500" />
            Test mode — send one copy to the test address and nothing to anyone else
          </label>

          {overCap && (
            <p className="mt-3 flex items-start gap-2 rounded bg-amber-50 p-3 text-sm text-amber-800">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {recipientCount} recipients is more than the {counts?.send_cap} we send in one go.
                Everyone will be queued; the rest go out on later runs.
              </span>
            </p>
          )}

          {!confirming ? (
            <button
              type="button"
              disabled={!canSend || sending}
              onClick={() => (testMode ? doSend() : setConfirming(true))}
              className="mt-4 inline-flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {sending ? 'Sending…' : testMode ? 'Send test copy' : 'Send for real'}
            </button>
          ) : (
            <div className="mt-4 rounded border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-900">
                Send &ldquo;{subject.trim()}&rdquo; to {recipientCount} {recipientCount === 1 ? 'person' : 'people'}?
              </p>
              <p className="mt-1 text-sm text-red-800">This cannot be undone.</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={doSend}
                  disabled={sending}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {sending ? 'Sending…' : `Yes, send to ${recipientCount}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 flex items-start gap-2 text-sm text-red-700">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {result && (
            <p className="mt-3 flex items-start gap-2 text-sm text-emerald-800">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {result.message}
                {result.test_mode && result.sent_to && <span className="text-slate-500"> ({result.sent_to})</span>}
              </span>
            </p>
          )}
        </section>

        <p className="mt-6 text-xs text-slate-500">
          <Link href="/dashboard/emails" className="underline">
            Back to the email list
          </Link>
        </p>
      </main>
    </div>
  );
}
