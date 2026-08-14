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

A CARD PER EMAIL, ADDED AS EACH IS TAKEN UP

Emails are being taken one at a time: rules agreed, numbers looked at properly, backlog dealt
with. Each one that has been through that gets its own card above the table - counted across
EVERY competition, and the only place that offers Send and Mark as sent. Two so far, the two
welcomes.

Setting `focus: true` on an OUTLINE row is all it takes to add the next - and it MOVES the email
rather than copying it: the table below holds only what has not been taken up yet, so it reads as
the to-do list and empties as cards appear. An email is in exactly one place.

What is left in the table stays per competition and preview only, which is deliberate: a screen
offering a platform-wide send on a dozen emails whose rules nobody has been through is exactly
what "I'm being careful for now" rules out.

Cards count ON REQUEST, one card at a time. Every number here is a live query - roughly 25ms each,
but against the whole platform - and the operator comes to this screen for one email. Counting all
of them on mount spends the work before knowing which one is wanted, so a card shows "Not counted
yet" until Count is pressed, and Refresh re-runs only that card.

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
   * Gets its own card above the table: counted across every competition, with send and
   * mark-as-sent. An email earns a card once its rules and its backlog have actually been gone
   * through - the table row alone is per-competition and preview-only.
   */
  focus?: boolean;
  /** Shown on the card only. What this email is, in a sentence. */
  blurb?: string;
}

/*
Row for row from docs/email/email-outline.xlsx, which is the authoritative list, in its order.

CONSUMER survives here even though the unsubscribe groups no longer use it. It is still how an
operator reads the list ("which of these does a player get?"), and it is a column of the outline
this table mirrors; it just no longer decides anything.
*/
const OUTLINE: OutlineEmail[] = [
  {
    key: 'results',
    consumer: 'Player',
    section: 'Game',
    name: 'Round Over',
    scoped: true,
    push: true,
    note: 'Round settled + next fixtures in',
    focus: true,
    blurb:
      'The one email every player gets every week. Their own result first, then who is still in, then what happens next. Not ready when the round ends — ready when the round ends AND the next round’s fixtures are in, or the competition has finished, so it is never a dead end.',
  },
  { key: 'pick_reminder', consumer: 'Player', section: 'Game', name: 'Pick reminder', scoped: true, push: true },
  {
    key: 'game_complete',
    consumer: 'Player',
    section: 'Game',
    name: 'Game complete',
    scoped: true,
    note: 'Everyone who took part, once',
    focus: true,
    blurb:
      'Goes to everyone who took part in a finished competition, winners and knocked-out alike — somebody out in round 2 still wants to know who won. Once per player per competition, ever. The outcome is derived from who is left: a named winner, a shared win, or nobody at all.',
  },
  { key: 'game_start_reminder', consumer: 'Organiser', section: 'Game', name: 'Game Start reminder', scoped: false, note: 'Stuck 14+ days, round waiting' },
  { key: 'share_reminder', consumer: 'Organiser', section: 'Game', name: 'Share reminder', scoped: true, note: 'Round 1 locks in 48h - joining closes' },
  {
    key: 'result_reminder',
    consumer: 'Organiser',
    section: 'Game',
    name: 'Result reminder',
    scoped: false,
    note: 'Round played 36h+, unsettled',
    focus: true,
    blurb:
      'The matches have been played and the round has not been settled, so the competition is frozen and nobody can move. Copy branches on how far they got — nothing entered, some entered, or all entered and just needing processing. A nudge, so marking it as sent defers it seven days rather than ending it.',
  },
  {
    key: 'fixture_reminder',
    consumer: 'Organiser',
    section: 'Game',
    name: 'Fixture reminder',
    scoped: false,
    note: 'Last round settled 3+ days',
    focus: true,
    blurb:
      'For an organiser who supplies their own fixtures: their last round is settled, three days have passed and the next round is not up, so their players are waiting. A nudge rather than a one-off — re-eligible seven days after the last attempt, so marking it as sent defers it rather than ending it.',
  },
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
  {
    key: 'created_comp',
    consumer: 'Organiser',
    section: 'Info',
    name: 'Welcome Created Comp',
    scoped: true,
    note: 'New competitions only',
    focus: true,
    blurb:
      'What an organiser gets after creating a competition — the invite code and join link, framed as the thing to forward. One recipient per competition, once ever. Not the confirmation screen again: this one has to be findable in an inbox a week later.',
  },
  {
    key: 'join_lms',
    consumer: 'All',
    section: 'Info',
    name: 'Welcome Join LMS',
    scoped: false,
    note: 'New signups only',
    focus: true,
    blurb:
      'What anyone gets once, when they first have an LMS Local account — however they arrived. No competition attached, so it explains the game and offers both doors rather than guessing whether they came to play or to organise.',
  },
  // The outline's BROADCAST block is deliberately absent from this table. Broadcast from Admin
  // lives on its own screen - the message is typed rather than derived, so there is nothing here
  // to preview or count, and the header button is the way in. Broadcast from Organiser was
  // dropped, not deferred - see docs/email/README.md. Do not re-add either row.
];

/*
An email is in exactly one place: a card once it has been taken up, the table until then. The
table is therefore the to-do list - what is left to work through - and it empties as cards appear.
*/
const FOCUS = OUTLINE.filter((e) => e.focus);
const REMAINING = OUTLINE.filter((e) => !e.focus);

/** Identity of a candidate is the user AND the competition, never the user alone. */
const keyOf = (r: { user_id: number; competition_id: number | null }) =>
  `${r.user_id}:${r.competition_id ?? 'null'}`;

/*
How long this person has been waiting. Relative rather than a date because the decision is about
age - "2 days" reads as send and "7 months" reads as mark-as-sent, where two ISO dates need
working out. The exact date is in the title attribute for when it matters.
*/
function ago(iso: string | null): string {
  if (!iso) return '—';
  /*
  Hours below two days, not days. Flooring to days made everything under 24h read as "today",
  which is wrong for somebody who joined last night and is the age that matters most here.
  */
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 48) return `${hours} hours`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days} days`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} month${months === 1 ? '' : 's'}` : `${Math.floor(days / 365)}y+`;
}

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
// Focus card
// ======================================================================================

/*
Each card fetches its OWN counts and nothing else - get-email-targets takes an email_types filter
for exactly this. Refreshing one card is one candidate query, not a pass over the catalog, so
looking at one email does not pay for eleven others.

Nothing loads until Count is pressed. The counts are live queries against the whole platform and
the operator opens this screen for one email at a time; loading all of them on mount spends the
work before knowing which one is wanted.
*/
function FocusCard({
  email,
  onOpen,
  /* Bumped by the page after a send or a mark, so the card that was acted on re-counts itself. */
  reloadToken,
}: {
  email: OutlineEmail;
  onOpen: () => void;
  reloadToken: number;
}) {
  const [count, setCount] = useState<EmailCount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getEmailTargets(null, [email.key]);
      if (res.return_code === 'SUCCESS' && res.counts?.[email.key]) {
        setCount(res.counts[email.key]);
      } else if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
        setError(res.message || 'Could not count');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}`);
    } finally {
      setLoading(false);
    }
  }, [email.key]);

  /* Only ever after an action on this card. A zero token is the initial state and loads nothing. */
  useEffect(() => {
    if (reloadToken > 0) load();
  }, [reloadToken, load]);

  return (
    <section className="rounded-xl border-2 border-indigo-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-6 px-5 py-4">
        <div className="max-w-lg">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{email.name}</h3>
            <SectionTag section={email.section} />
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{email.key}</code>
          </div>
          {email.blurb && <p className="mt-1.5 text-sm text-slate-600">{email.blurb}</p>}
          {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-start gap-8">
          {count ? (
            <>
              <Stat value={count.waiting} label="waiting" />
              {email.scoped && (
                <Stat value={count.competitions} label={count.competitions === 1 ? 'competition' : 'competitions'} />
              )}
              {/* Without this, an email showing zero waiting is ambiguous: caught up, or never
                  sending at all. */}
              <Stat value={count.sent_recently} label="sent" />
            </>
          ) : (
            <p className="pt-2 text-sm text-slate-400">{loading ? 'Counting…' : 'Not counted yet'}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
        <p className="text-xs text-slate-500">Counted across every competition, not the one picked below.</p>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {count ? 'Refresh' : 'Count'}
          </button>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-900"
          >
            <EyeIcon className="h-4 w-4" />
            Review, send or mark as sent
          </button>
        </div>
      </div>
    </section>
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
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /*
  Scoped emails send the selected competition, unless the focus card opened this - then they send
  nothing and the server scans every competition. Platform-wide emails never send one.
  */
  const scopeId = scopeAll || !email.scoped ? null : competition?.id ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelected(new Set());
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

  const allSelected = recipients.length > 0 && selected.size === recipients.length;

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

  /*
  NOTHING happens without a tick. Every action on this panel - test, live, mark - acts on the
  ticked rows and nothing else, and all three are dead until at least one is ticked.

  The alternative, an untTicked panel meaning "everyone", put the most far-reaching action behind
  the least deliberate gesture: open a card, press a button, and the whole qualifying set goes.
  Select all is one click away when everyone really is the intent.

  The SERVER still accepts a send with no list and treats it as everyone - that is the cron's
  contract, and it must not depend on somebody having ticked a box.
  */
  const chosen = recipients.filter((r) => selected.has(keyOf(r)));
  const nothingChosen = chosen.length === 0;
  const chosenPayload = chosen.map((r) => ({ user_id: r.user_id, competition_id: r.competition_id }));

  const handleSend = () =>
    run(async () => {
      // Always an explicit list, so expected_count has nothing to guard here.
      const res = await adminApi.sendEmails(email.key, scopeId, testMode, undefined, chosenPayload);

      if (res.return_code === 'SUCCESS') return res.message || 'Done';
      if (res.return_code === 'NO_RECIPIENTS') return res.message || 'Nobody qualifies';
      if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
        setError(res.message || 'Send failed');
      }
      return null;
    });

  const handleMark = () =>
    run(async () => {
      const res = await adminApi.markEmailsSent(email.key, scopeId, {
        recipients: chosenPayload,
        reason: 'Marked from the admin Emails screen',
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
              {/*
              The list IS the screen. What is being checked here is who qualifies and whether
              they look right - the template was signed off once and is not re-read every time.
              So it opens expanded, with no toggle in front of it.
              */}
              {count === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Nobody qualifies for this email right now.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium text-slate-900">{count.toLocaleString()}</span>{' '}
                      {count === 1 ? 'person' : 'people'} waiting, after preferences and opt-outs
                    </p>
                    <button
                      onClick={() => setSelected(allSelected ? new Set() : new Set(recipients.map(keyOf)))}
                      className="text-sm text-slate-500 underline-offset-2 hover:underline"
                    >
                      {allSelected ? 'Clear selection' : 'Select all'}
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="w-8 px-3 py-2"></th>
                          <th className="px-3 py-2 font-semibold">Name</th>
                          <th className="px-3 py-2 font-semibold">Email</th>
                          {email.scoped && <th className="px-3 py-2 font-semibold">Competition</th>}
                          <th className="px-3 py-2 font-semibold">Waiting since</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recipients.map((r) => (
                          <tr key={keyOf(r)} className={selected.has(keyOf(r)) ? 'bg-slate-50' : ''}>
                            <td className="px-3 py-2">
                              {/* Ticking is how a run of test accounts gets marked off without
                                  touching the real players in the same list. */}
                              <input
                                type="checkbox"
                                checked={selected.has(keyOf(r))}
                                onChange={() => toggle(r)}
                                className="h-4 w-4 rounded border-slate-300"
                                aria-label={`Select ${r.display_name}`}
                              />
                            </td>
                            <td className="px-3 py-2 text-slate-800">{r.display_name}</td>
                            <td className="px-3 py-2 text-slate-500">{r.email}</td>
                            {email.scoped && (
                              <td className="px-3 py-2 text-slate-500">{r.competition_name ?? '—'}</td>
                            )}
                            {/* The judgement this screen exists for: a join from yesterday is a
                                send, one from January is a mark-as-sent. */}
                            <td
                              className="px-3 py-2 whitespace-nowrap text-slate-500"
                              title={r.since ? new Date(r.since).toLocaleString() : undefined}
                            >
                              {ago(r.since)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview?.truncated && (
                      /* Ticking only reaches what is listed, so say so rather than let the bulk
                         button and the checkboxes look like they cover the same set. */
                      <p className="border-t border-slate-100 px-3 py-2 text-xs italic text-slate-400">
                        First {recipients.length} shown of {count.toLocaleString()}. Ticking applies to
                        these; “mark all” covers every one of the {count.toLocaleString()}.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* The summary line. Last thing read before the button. */}
              {/* Nothing ticked is the resting state, so say what to do rather than warn about a
                  send that cannot happen. */}
              {count > 0 && nothingChosen && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Tick the people you want. Nothing sends or gets marked until you do.
                </p>
              )}

              {count > 0 &&
                !nothingChosen &&
                (testMode ? (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <BeakerIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900">Test mode — 1 email to the test address</p>
                      <p className="text-amber-700">
                        Built from {chosen[0]?.display_name}&apos;s data. Nobody real is touched and nothing is
                        queued.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div className="text-sm">
                      <p className="font-medium text-red-900">
                        Live send — {chosen.length.toLocaleString()} ticked recipient
                        {chosen.length === 1 ? '' : 's'}
                      </p>
                      <p className="text-red-700">This goes to actual people. There is no undo.</p>
                    </div>
                  </div>
                ))}

              {/*
              No type-to-confirm. Switching to live is itself the deliberate act, the red panel
              above states the number, and a second gate on the same screen only reads as noise.
              The count is still sent as expected_count and the server still refuses a send that
              has grown since - the guard that matters is the one against a stale number, not
              against the operator.
              */}
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
              onClick={handleMark}
              disabled={busy || nothingChosen}
              title="Mark the ticked rows as sent without emailing anyone"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark {chosen.length} as sent
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={loading || busy || nothingChosen}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
              testMode ? 'bg-slate-700 hover:bg-slate-800' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {/* Always names the number it is about to send to, so "all" versus "the ticked ones"
                is never something the operator has to remember. */}
            {busy ? 'Working…' : testMode ? 'Send test' : `Send live to ${chosen.length}`}
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
  /* Bumped per email after a send or a mark. Each card watches its own entry and re-counts, so
     acting on one card does not re-query the others. */
  const [reloadTokens, setReloadTokens] = useState<Record<string, number>>({});
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
      // Only what the table still shows - the carded emails count themselves, on request.
      const res = await adminApi.getEmailTargets(id, REMAINING.map((e) => e.key));
      setCounts(res.return_code === 'SUCCESS' && res.counts ? res.counts : {});
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

  /* Only the card that was acted on. A send from one card cannot change another's count. */
  const refreshCard = (key: string) =>
    setReloadTokens((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));

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
            One card per email taken up so far. Each counts itself, on request.
            ============================================================================ */}
        {FOCUS.map((email) => (
          <FocusCard
            key={email.key}
            email={email}
            reloadToken={reloadTokens[email.key] ?? 0}
            onOpen={() => setOpen({ email, scopeAll: true })}
          />
        ))}

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
            Still to work through
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
                {REMAINING.map((email) => {
                  // undefined means the server did not work this one out - not the same as zero.
                  const c = counts[email.key];
                  return (
                    <tr key={email.key} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{email.consumer}</td>
                      <td className="px-4 py-3">
                        <SectionTag section={email.section} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{email.name}</span>
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
                          c.waiting.toLocaleString()
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
          onChanged={() => (open.scopeAll ? refreshCard(open.email.key) : refreshCounts())}
        />
      )}
    </div>
  );
}
