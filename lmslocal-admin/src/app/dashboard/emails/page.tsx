'use client';

/*
=======================================================================================================================================
Admin Emails
=======================================================================================================================================
Purpose: One place to see every email on the outline, preview who it would go to, send it, or mark
         people as dealt with without sending.

The spine is docs/email/email-outline.xlsx - the same rows in the same order. A row whose service
is missing would be refused by the server with UNSUPPORTED_EMAIL_TYPE rather than half-sent, so
this table does not have to police that. The server's own list is services/emailCatalog.js - add
an email there and add its row here.

THE FOCUS CARD, AND WHY ONE EMAIL AT A TIME

Emails are being taken one at a time: its rules are agreed, its numbers are looked at properly,
its backlog is dealt with, and only then does the next one come up. The card at the top is
whichever email that currently is. It is the only place that counts across EVERY competition and
the only place that offers Mark as sent.

Setting `focus: true` on an OUTLINE row is all it takes to bring the next email up here. The rest
of the table stays as it is - per competition, preview only - which is deliberate: a screen that
offered a platform-wide send on twelve emails at once is exactly what "I'm being careful for now"
rules out.

TEST MODE defaults to on at every page load and is deliberately not persisted. A sticky "off"
surviving a refresh is how the whole user base gets mailed by accident. In test mode the server
sends exactly one copy to the test address and queues nothing; see routes/admin/send-emails.js
for why queuing during a test would break the real send that follows.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowPathIcon,
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import {
  adminApi,
  getToken,
  apiBaseUrl,
  AdminCompetition,
  EmailCount,
  EmailRecipient,
  PreviewEmailResponse,
} from '@/lib/api';

// ======================================================================================
// The outline
// ======================================================================================

type Consumer = 'Player' | 'Organiser' | 'All';
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
  /** Whether recipients depend on the selected competition. */
  scoped: boolean;
  /** Marked Y in the outline's MOBILE NOTIFICATION column. */
  push?: boolean;
  note?: string;
  /**
   * The email currently being worked on. Gets its own card, counted across every competition,
   * with send and mark-as-sent. One at a time, on purpose - see the header.
   */
  focus?: boolean;
  /** Shown on the focus card only. What this email is, in a sentence. */
  blurb?: string;
}

/*
Row for row from docs/email/email-outline.xlsx, which is the authoritative list, in its order.

CONSUMER survives here even though the unsubscribe groups no longer use it. It is still how an
operator reads the list ("which of these does a player get?"), and it is a column of the outline
this table mirrors; it just no longer decides anything.
*/
const OUTLINE: OutlineEmail[] = [
  { key: 'results', consumer: 'Player', section: 'Game', name: 'Round Over', scoped: true, push: true, note: 'Round settled + next fixtures in' },
  { key: 'pick_reminder', consumer: 'Player', section: 'Game', name: 'Pick reminder', scoped: true, push: true },
  { key: 'game_complete', consumer: 'Player', section: 'Game', name: 'Game complete', scoped: true, note: 'Everyone who took part, once' },
  { key: 'game_start_reminder', consumer: 'Organiser', section: 'Game', name: 'Game Start reminder', scoped: false, note: 'Stuck 14+ days, round waiting' },
  { key: 'share_reminder', consumer: 'Organiser', section: 'Game', name: 'Share reminder', scoped: true, note: 'Round 1 locks in 48h - joining closes' },
  { key: 'result_reminder', consumer: 'Organiser', section: 'Game', name: 'Result reminder', scoped: false, note: 'Round played 36h+, unsettled' },
  { key: 'fixture_reminder', consumer: 'Organiser', section: 'Game', name: 'Fixture reminder', scoped: false, note: 'Last round settled 3+ days' },
  { key: 'promote_competition', consumer: 'Organiser', section: 'Info', name: 'Hint - Promote competition', scoped: false, note: '3 days after creating, once ever' },
  { key: 'update_scores_mid_round_tip', consumer: 'Organiser', section: 'Info', name: 'Hint - Result set mid round', scoped: false, note: '7 days, manual comps with fixtures' },
  {
    key: 'welcome',
    consumer: 'Player',
    section: 'Info',
    name: 'Welcome Join Comp',
    scoped: true,
    note: 'New joins only',
    focus: true,
    blurb:
      'What a player gets after joining someone else’s competition. Once per membership, ever. The organiser is excluded — they get Welcome Created Comp instead.',
  },
  { key: 'created_comp', consumer: 'Organiser', section: 'Info', name: 'Welcome Created Comp', scoped: true, note: 'New competitions only' },
  { key: 'join_lms', consumer: 'All', section: 'Info', name: 'Welcome Join LMS', scoped: false, note: 'New signups only' },
  // The outline's BROADCAST block is deliberately absent from this table. Broadcast from Admin
  // lives on its own screen - the message is typed rather than derived, so there is nothing here
  // to preview or count, and the header button is the way in. Broadcast from Organiser was
  // dropped, not deferred - see docs/email/README.md. Do not re-add either row.
];

const FOCUS = OUTLINE.filter((e) => e.focus);

/** Identity of a candidate is the user AND the competition, never the user alone. */
const keyOf = (r: { user_id: number; competition_id: number | null }) =>
  `${r.user_id}:${r.competition_id ?? 'null'}`;

// ======================================================================================
// Small presentational pieces
// ======================================================================================

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

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'plain' | 'warn' }) {
  return (
    <div>
      <p className={`text-2xl font-semibold tabular-nums ${tone === 'warn' && value > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ======================================================================================
// Send panel
// ======================================================================================

function SendPanel({
  email,
  competition,
  scopeAll,
  testMode,
  onClose,
  onChanged,
}: {
  email: OutlineEmail;
  /* Null for platform-wide emails, which have no competition and never send one to the server. */
  competition: AdminCompetition | null;
  /* Opened from the focus card: count, send and mark across every competition. */
  scopeAll: boolean;
  testMode: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState<PreviewEmailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showList, setShowList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /* Typed back before anything irreversible. Cleared on every reload so it cannot go stale. */
  const [confirmValue, setConfirmValue] = useState('');

  /*
  Scoped emails send the selected competition, unless the focus card opened this - then they send
  nothing and the server scans every competition. Platform-wide emails never send one.
  */
  const scopeId = scopeAll || !email.scoped ? null : competition?.id ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelected(new Set());
    setConfirmValue('');
    try {
      const res = await adminApi.previewEmail(email.key, scopeId);
      if (res.return_code === 'SUCCESS') {
        setPreview(res);
      } else if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
        setError(res.message || 'Could not build the preview');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}`);
    } finally {
      setLoading(false);
    }
  }, [email.key, scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  const count = preview?.recipient_count ?? 0;
  const recipients: EmailRecipient[] = useMemo(() => preview?.recipients ?? [], [preview]);

  /*
  Both irreversible actions are gated on typing the number back. The two share one input because
  they share one number - what is being confirmed is the size of the thing about to happen.
  */
  const confirmed = confirmValue.trim() !== '' && Number(confirmValue) === count;

  const toggle = (r: EmailRecipient) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = keyOf(r);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError('');
    try {
      const message = await fn();
      if (message !== null) {
        setResult(message);
        onChanged();
        await load();
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSend = () =>
    run(async () => {
      const res = await adminApi.sendEmails(email.key, scopeId, testMode, testMode ? undefined : count);

      if (res.return_code === 'SUCCESS') return res.message || 'Done';
      if (res.return_code === 'NO_RECIPIENTS') return res.message || 'Nobody qualifies';
      if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
        setError(res.message || 'Send failed');
      }
      return null;
    });

  const handleMark = (onlySelected: boolean) =>
    run(async () => {
      const chosen = recipients.filter((r) => selected.has(keyOf(r)));
      const res = await adminApi.markEmailsSent(email.key, scopeId, {
        recipients: onlySelected
          ? chosen.map((r) => ({ user_id: r.user_id, competition_id: r.competition_id }))
          : undefined,
        expectedCount: onlySelected ? undefined : count,
        reason: onlySelected ? 'Marked individually from the admin Emails screen' : undefined,
      });

      if (res.return_code === 'SUCCESS') return res.message || 'Marked';
      if (res.return_code === 'NO_RECIPIENTS') return res.message || 'Nothing to mark';
      if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
        setError(res.message || 'Could not mark those as sent');
      }
      return null;
    });

  const scopeLabel = !email.scoped
    ? 'Everyone on the platform'
    : scopeAll
      ? 'Every competition'
      : competition?.name ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{email.name}</h2>
            <p className="text-sm text-slate-500">
              {email.consumer} · {email.section} · {scopeLabel}
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
                    {scopeAll && email.scoped
                      ? 'Across every competition, after preferences and opt-outs'
                      : email.scoped
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
                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200">
                  <ul className="divide-y divide-slate-100 text-sm">
                    {recipients.map((r) => (
                      <li key={keyOf(r)} className="flex items-center gap-3 px-4 py-2">
                        {/* Ticking is how a run of test accounts gets marked off without touching
                            the real players in the same list. */}
                        <input
                          type="checkbox"
                          checked={selected.has(keyOf(r))}
                          onChange={() => toggle(r)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300"
                          aria-label={`Select ${r.display_name}`}
                        />
                        <span className="flex-1 text-slate-700">{r.display_name}</span>
                        {scopeAll && r.competition_name && (
                          <span className="shrink-0 text-xs text-slate-400">{r.competition_name}</span>
                        )}
                        <span className="shrink-0 text-slate-500">{r.email}</span>
                      </li>
                    ))}
                    {preview?.truncated && (
                      /* Ticking only reaches what is listed, so say so rather than let the bulk
                         button and the checkboxes look like they cover the same set. */
                      <li className="px-4 py-2 text-xs italic text-slate-400">
                        First {recipients.length} shown of {count.toLocaleString()}. Ticking applies to
                        these; “mark all” covers every one of the {count.toLocaleString()}.
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

              {/* Type-to-confirm. Gates the live send and the bulk mark; the ticked-list mark and
                  the test send are their own confirmation and do not need it. */}
              {count > 0 && (!testMode || email.focus) && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
                  <label htmlFor="confirm" className="text-sm text-slate-700">
                    Type <span className="font-semibold tabular-nums">{count}</span> to confirm a live send or
                    marking them all:
                  </label>
                  <input
                    id="confirm"
                    value={confirmValue}
                    onChange={(e) => setConfirmValue(e.target.value)}
                    inputMode="numeric"
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums"
                    placeholder="—"
                  />
                  {confirmed && <CheckCircleIcon className="h-5 w-5 text-emerald-600" />}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
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

          {/* Mark as sent, on the focus card's email only - it is the one whose rules and backlog
              have actually been gone through. */}
          {email.focus && count > 0 && (
            <button
              onClick={() => handleMark(selected.size > 0)}
              disabled={busy || (selected.size === 0 && !confirmed)}
              title={
                selected.size > 0
                  ? `Mark the ${selected.size} ticked as sent`
                  : `Mark all ${count} as sent without emailing anyone`
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selected.size > 0 ? `Mark ${selected.size} selected as sent` : `Mark all ${count} as sent`}
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={loading || busy || count === 0 || (!testMode && !confirmed)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
              testMode ? 'bg-slate-700 hover:bg-slate-800' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {busy ? 'Working…' : testMode ? 'Send test' : 'Send live'}
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
  /* Per the picked competition, for the table. */
  const [counts, setCounts] = useState<Record<string, EmailCount>>({});
  /* Across every competition, for the focus card. Deliberately a separate call and a separate
     number - the table's is "in this competition" and the card's is "anywhere". */
  const [focusCounts, setFocusCounts] = useState<Record<string, EmailCount>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<{ email: OutlineEmail; scopeAll: boolean } | null>(null);

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
      setCounts(res.return_code === 'SUCCESS' && res.counts ? res.counts : {});
    } catch {
      setCounts({});
    }
  }, []);

  const loadFocusCounts = useCallback(async () => {
    if (FOCUS.length === 0) return;
    try {
      const res = await adminApi.getEmailTargets(null, FOCUS.map((e) => e.key));
      setFocusCounts(res.return_code === 'SUCCESS' && res.counts ? res.counts : {});
    } catch {
      setFocusCounts({});
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadCompetitions();
    loadFocusCounts();
  }, [router, loadCompetitions, loadFocusCounts]);

  useEffect(() => {
    if (competitionId !== null) loadCounts(competitionId);
  }, [competitionId, loadCounts]);

  const refreshCounts = () => {
    if (competitionId !== null) loadCounts(competitionId);
    loadFocusCounts();
  };

  return (
    <div className="min-h-screen">
      <AdminHeader>
        {/* Broadcast has its own screen: it carries typed text and needs an audience count and a
            confirmation before sending, which would be noise on every row here. */}
        <Link
          href="/dashboard/emails/broadcast"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
        >
          <MegaphoneIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Broadcast</span>
        </Link>
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

        {/* ============================================================================
            Focus card - the email being worked on right now
            ============================================================================ */}
        {FOCUS.map((email) => {
          const c = focusCounts[email.key];
          return (
            <section key={email.key} className="rounded-xl border-2 border-indigo-200 bg-white shadow-sm">
              <h2 className="flex items-center gap-2 rounded-t-lg border-b border-indigo-100 bg-indigo-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Working on now
              </h2>

              <div className="flex flex-wrap items-start justify-between gap-6 px-5 py-4">
                <div className="max-w-lg">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{email.name}</h3>
                    <SectionTag section={email.section} />
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{email.key}</code>
                  </div>
                  {email.blurb && <p className="mt-1.5 text-sm text-slate-600">{email.blurb}</p>}
                </div>

                <div className="flex items-start gap-8">
                  {c ? (
                    <>
                      <Stat value={c.waiting} label="waiting" />
                      {email.scoped && <Stat value={c.competitions} label={c.competitions === 1 ? 'competition' : 'competitions'} />}
                      {/* Only ever non-zero if something queued without sending. Amber so it is
                          not mistaken for a normal number - nine stale rows once sat unnoticed. */}
                      <Stat value={c.pending} label="pending" tone="warn" />
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">Counting…</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-500">
                  Counted across every competition, not the one picked below.
                </p>
                <button
                  onClick={() => setOpen({ email, scopeAll: true })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-900"
                >
                  <EyeIcon className="h-4 w-4" />
                  Review, send or mark as sent
                </button>
              </div>
            </section>
          );
        })}

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
            Applies to the table below. Platform-wide rows ignore it, and so does the card above.
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
                  <th className="px-4 py-3 text-right font-semibold">Recipients</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {OUTLINE.map((email) => {
                  // undefined means the server did not work this one out - not the same as zero.
                  const c = counts[email.key];
                  return (
                    <tr key={email.key} className={`transition hover:bg-slate-50 ${email.focus ? 'bg-indigo-50/40' : ''}`}>
                      <td className="px-4 py-3 text-slate-600">{email.consumer}</td>
                      <td className="px-4 py-3">
                        <SectionTag section={email.section} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{email.name}</span>
                        {email.focus && (
                          <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                            in focus
                          </span>
                        )}
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
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {c ? (
                          <>
                            {c.waiting.toLocaleString()}
                            {c.pending > 0 && (
                              <span className="ml-1.5 text-xs text-amber-700" title="Queued and not yet sent">
                                +{c.pending} pending
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300" title="Not worked out yet">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(competition || !email.scoped) && (
                          <button
                            onClick={() => setOpen({ email, scopeAll: false })}
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

      {open && (competition || !open.email.scoped || open.scopeAll) && (
        <SendPanel
          email={open.email}
          competition={competition}
          scopeAll={open.scopeAll}
          testMode={testMode}
          onClose={() => setOpen(null)}
          onChanged={refreshCounts}
        />
      )}
    </div>
  );
}
