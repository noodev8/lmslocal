'use client';

/*
=======================================================================================================================================
Admin Emails
=======================================================================================================================================
Purpose: One place to see every email on the outline, preview who it would go to, and send it.

The spine is docs/email/email-outline.xlsx - the same rows in the same order, including the ones
not built yet. Showing the gaps costs one greyed row each and means the screen doubles as a map
of what is left to do, rather than quietly omitting anything with no code behind it.

Three emails are wired end to end so far: pick_reminder, join_lms and created_comp. Rows with
wired: false render
greyed with no Preview button, and the server refuses them anyway with UNSUPPORTED_EMAIL_TYPE -
the screen is not the only thing stopping a send. The server's own list is
services/emailCatalog.js; `wired` here has to be kept in step with it by hand.

Platform-wide rows (scoped: false) ignore the competition picker entirely. Their panel says so,
and passes no competition_id at all rather than a meaningless one.

TEST MODE defaults to on at every page load and is deliberately not persisted. A sticky "off"
surviving a refresh is how the whole user base gets mailed by accident. In test mode the server
sends exactly one copy to the test address and queues nothing; see routes/admin/send-emails.js
for why queuing during a test would break the real send that follows.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowPathIcon,
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import {
  adminApi,
  getToken,
  apiBaseUrl,
  AdminCompetition,
  EmailRecipient,
  PreviewEmailResponse,
} from '@/lib/api';

// ======================================================================================
// The outline
// ======================================================================================

// 'Game Members' arrived with the BROADCAST block: an organiser broadcasting to their own
// competition, which is neither "every player on the platform" nor a role.
type Consumer = 'Player' | 'Organiser' | 'All' | 'Game Members';
// The outline has exactly two sections since 2026-08-11, and they are also the two unsubscribe
// groups. Welcome and Tips were folded into Info.
type Section = 'Game' | 'Info';

interface OutlineEmail {
  /** Matches email_queue.email_type once built. */
  key: string;
  consumer: Consumer;
  section: Section;
  /** The EMAIL column from the outline, verbatim. */
  name: string;
  /** Built AND reachable from this screen. Mirrors services/emailCatalog.js. */
  wired: boolean;
  /** Whether recipients depend on the selected competition. */
  scoped: boolean;
  /** Marked Y in the outline's MOBILE NOTIFICATION column. */
  push?: boolean;
  note?: string;
}

/*
Row for row from docs/email/email-outline.xlsx, which is the authoritative list, in its order.

Rewritten 2026-08-11 when the outline was cut to two sections. What changed: Welcome disappeared
as a section and its three emails moved to Info, "Organiser Game Invite" came off the outline
entirely, and "Game started" is back as its own row - push only, with no email behind it.

CONSUMER survives here even though the unsubscribe groups no longer use it. It is still how an
operator reads the list ("which of these does a player get?"), and it is a column of the outline
this table mirrors; it just no longer decides anything.
*/
const OUTLINE: OutlineEmail[] = [
  { key: 'results', consumer: 'Player', section: 'Game', name: 'Round Over', wired: true, scoped: true, push: true, note: 'Round settled + next fixtures in' },
  { key: 'pick_reminder', consumer: 'Player', section: 'Game', name: 'Pick reminder', wired: true, scoped: true, push: true },
  { key: 'game_complete', consumer: 'Player', section: 'Game', name: 'Game complete', wired: true, scoped: true, note: 'Everyone who took part, once' },
  { key: 'game_start_reminder', consumer: 'Organiser', section: 'Game', name: 'Game Start reminder', wired: true, scoped: false, note: 'Stuck 14+ days, round waiting' },
  { key: 'result_reminder', consumer: 'Organiser', section: 'Game', name: 'Result reminder', wired: true, scoped: false, note: 'Round played 36h+, unsettled' },
  { key: 'fixture_reminder', consumer: 'Organiser', section: 'Game', name: 'Fixture reminder', wired: true, scoped: false, note: 'Last round settled 3+ days' },
  { key: 'promote_competition', consumer: 'Organiser', section: 'Info', name: 'Hint - Promote competition', wired: true, scoped: false, note: '3 days after creating, once ever' },
  { key: 'update_scores_mid_round_tip', consumer: 'Organiser', section: 'Info', name: 'Hint - Result set mid round', wired: true, scoped: false, note: '7 days, manual comps with fixtures' },
  { key: 'welcome', consumer: 'Player', section: 'Info', name: 'Welcome Join Comp', wired: true, scoped: true, note: 'New joins only' },
  { key: 'created_comp', consumer: 'Organiser', section: 'Info', name: 'Welcome Created Comp', wired: true, scoped: true, note: 'New competitions only' },
  { key: 'join_lms', consumer: 'All', section: 'Info', name: 'Welcome Join LMS', wired: true, scoped: false, note: 'New signups only' },
  // BROADCAST block on the outline. Neither is built; both are already mapped to the info group
  // in emailPreference.js so that neither can be built without an opt-out.
  { key: 'broadcast_admin', consumer: 'All', section: 'Info', name: 'Broadcast from Admin', wired: false, scoped: false, note: 'Broadcast' },
  { key: 'broadcast_organiser', consumer: 'Game Members', section: 'Info', name: 'Broadcast from Organiser', wired: false, scoped: true, note: 'Broadcast' },
];

// ======================================================================================
// Small presentational pieces
// ======================================================================================

function StatusPill({ wired }: { wired: boolean }) {
  return wired ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Ready
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      Not wired
    </span>
  );
}

function SectionTag({ section }: { section: Section }) {
  /*
  Section IS the unsubscribe group now, not half of it, so it earns a visual identity: this tag
  is what a recipient can switch off, and every email carrying it goes silent together.
  */
  const tone: Record<Section, string> = {
    Game: 'bg-indigo-50 text-indigo-700',
    Info: 'bg-amber-50 text-amber-700',
  };
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${tone[section]}`}>{section}</span>;
}

// ======================================================================================
// Send panel
// ======================================================================================

function SendPanel({
  email,
  competition,
  testMode,
  onClose,
  onSent,
}: {
  email: OutlineEmail;
  /* Null for platform-wide emails, which have no competition and never send one to the server. */
  competition: AdminCompetition | null;
  testMode: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [preview, setPreview] = useState<PreviewEmailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showList, setShowList] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  /* Scoped emails send the selected competition; platform-wide ones send nothing. */
  const scopeId = email.scoped ? competition?.id ?? null : null;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await adminApi.previewEmail(email.key, scopeId);
        if (cancelled) return;

        if (res.return_code === 'SUCCESS') {
          setPreview(res);
        } else if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
          setError(res.message || 'Could not build the preview');
        }
      } catch {
        if (!cancelled) setError(`Could not reach ${apiBaseUrl}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email.key, scopeId]);

  const count = preview?.recipient_count ?? 0;
  const recipients: EmailRecipient[] = preview?.recipients ?? [];

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      const res = await adminApi.sendEmails(email.key, scopeId, testMode);

      if (res.return_code === 'SUCCESS') {
        setResult(res.message || 'Done');
        onSent();
      } else if (res.return_code === 'NO_RECIPIENTS') {
        setResult(res.message || 'Nobody qualifies');
      } else if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
        setError(res.message || 'Send failed');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{email.name}</h2>
            <p className="text-sm text-slate-500">
              {email.consumer} · {email.section} ·{' '}
              {email.scoped ? competition?.name : 'Everyone on the platform'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Working out recipients…</p>
          ) : (
            <>
              {/* Recipients */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {count.toLocaleString()} recipient{count === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {email.scoped
                      ? 'Eligible after preferences and opt-outs'
                      : 'Across the whole platform, after preferences and opt-outs'}
                  </p>
                </div>
                {count > 0 && (
                  <button
                    onClick={() => setShowList((v) => !v)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    {showList ? 'Hide list' : 'View list'}
                  </button>
                )}
              </div>

              {showList && recipients.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                  <ul className="divide-y divide-slate-100 text-sm">
                    {recipients.map((r) => (
                      <li key={r.user_id} className="flex justify-between gap-3 px-4 py-2">
                        <span className="text-slate-700">{r.display_name}</span>
                        <span className="text-slate-500">{r.email}</span>
                      </li>
                    ))}
                    {preview?.truncated && (
                      <li className="px-4 py-2 text-xs italic text-slate-400">
                        First {recipients.length} shown of {count.toLocaleString()}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* The real rendered template */}
              {preview?.sample ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Preview — {preview.sample.for_email}&apos;s copy
                  </p>
                  <p className="mb-2 text-sm text-slate-700">
                    <span className="text-slate-400">Subject: </span>
                    {preview.sample.subject}
                  </p>
                  {/*
                  Sandboxed so the email's own markup cannot reach this page. srcDoc rather than a
                  src, because the HTML only exists in this response.
                  */}
                  <iframe
                    title="Email preview"
                    srcDoc={preview.sample.html}
                    sandbox=""
                    className="h-96 w-full rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              ) : (
                !loading && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Nobody qualifies for this email right now, so there is nothing to preview.
                  </p>
                )
              )}

              {/* The summary line. Last thing read before the button. */}
              {count > 0 &&
                (testMode ? (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <BeakerIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900">Test mode — 1 email to the test address</p>
                      <p className="text-amber-700">
                        {count.toLocaleString()} real recipient{count === 1 ? '' : 's'} untouched, and nothing queued.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div className="text-sm">
                      <p className="font-medium text-red-900">
                        Live send — {count.toLocaleString()} real recipient{count === 1 ? '' : 's'}
                      </p>
                      <p className="text-red-700">This goes to actual people. There is no undo.</p>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          {result && (
            <span className="mr-auto flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircleIcon className="h-4 w-4" />
              {result}
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={handleSend}
            disabled={loading || sending || count === 0}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
              testMode ? 'bg-slate-700 hover:bg-slate-800' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {sending ? 'Sending…' : testMode ? 'Send test' : 'Send live'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================================================================================
// Page
// ======================================================================================

export default function EmailsPage() {
  const router = useRouter();

  /* Not persisted and not read from storage - see the header. Every page load starts armed. */
  const [testMode, setTestMode] = useState(true);

  const [competitions, setCompetitions] = useState<AdminCompetition[]>([]);
  const [competitionId, setCompetitionId] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<OutlineEmail | null>(null);

  const competition = useMemo(
    () => competitions.find((c) => c.id === competitionId) ?? null,
    [competitions, competitionId]
  );

  const loadCompetitions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getCompetitions();
      if (res.return_code === 'SUCCESS' && res.competitions) {
        setCompetitions(res.competitions);
        setCompetitionId((current) => current ?? res.competitions?.[0]?.id ?? null);
      } else if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
        setError(res.message || 'Could not load competitions');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}. The server may be down.`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCounts = useCallback(async (id: number) => {
    try {
      const res = await adminApi.getEmailTargets(id);
      if (res.return_code === 'SUCCESS' && res.counts) {
        setCounts(res.counts);
      } else {
        setCounts({});
      }
    } catch {
      setCounts({});
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadCompetitions();
  }, [router, loadCompetitions]);

  useEffect(() => {
    if (competitionId !== null) loadCounts(competitionId);
  }, [competitionId, loadCounts]);

  const refreshCounts = () => {
    if (competitionId !== null) loadCounts(competitionId);
  };

  return (
    <div className="min-h-screen">
      <AdminHeader>
        <button
          onClick={refreshCounts}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </AdminHeader>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {/* Mode bar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            testMode ? 'border-amber-200 bg-amber-50' : 'border-red-300 bg-red-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {testMode ? (
              <BeakerIcon className="h-5 w-5 shrink-0 text-amber-600" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <div className="text-sm">
              {testMode ? (
                <>
                  <p className="font-medium text-amber-900">Test mode on</p>
                  <p className="text-amber-700">
                    One copy goes to the test address. Nothing is queued and no player is touched.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-red-900">Live sending</p>
                  <p className="text-red-700">Emails go to real people. Resets to test on refresh.</p>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => setTestMode((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              testMode
                ? 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {testMode ? 'Switch to live' : 'Back to test'}
          </button>
        </div>

        {/* Competition picker */}
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="competition" className="text-sm font-medium text-slate-700">
            Competition
          </label>
          <select
            id="competition"
            value={competitionId ?? ''}
            onChange={(e) => setCompetitionId(Number(e.target.value))}
            disabled={competitions.length === 0}
            className="max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 disabled:opacity-50"
          >
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (#{c.id})
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">
            Applies to competition-scoped emails. Platform-wide rows ignore it.
          </span>
        </div>

        {/* The outline */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            Emails
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Consumer</th>
                  <th className="px-4 py-3 font-semibold">Section</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Recipients</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {OUTLINE.map((email) => {
                  // undefined means the server did not work this one out - not the same as zero.
                  const count = counts[email.key];
                  return (
                    <tr
                      key={email.key}
                      className={`transition ${email.wired ? 'hover:bg-slate-50' : 'bg-slate-50/40'}`}
                    >
                      <td className="px-4 py-3 text-slate-600">{email.consumer}</td>
                      <td className="px-4 py-3">
                        <SectionTag section={email.section} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={email.wired ? 'font-medium text-slate-900' : 'text-slate-400'}>
                          {email.name}
                        </span>
                        {email.push && (
                          <span
                            className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500"
                            title="Marked for mobile notification on the outline"
                          >
                            push
                          </span>
                        )}
                        {email.note && <span className="ml-2 text-xs italic text-slate-400">{email.note}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill wired={email.wired} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {typeof count === 'number' ? (
                          count.toLocaleString()
                        ) : (
                          <span className="text-slate-300" title="Not worked out yet">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {email.wired && (competition || !email.scoped) && (
                          <button
                            onClick={() => setOpen(email)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                          >
                            <EyeIcon className="h-4 w-4" />
                            Preview
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {open && (competition || !open.scoped) && (
        <SendPanel
          email={open}
          competition={competition}
          testMode={testMode}
          onClose={() => setOpen(null)}
          onSent={refreshCounts}
        />
      )}
    </div>
  );
}
