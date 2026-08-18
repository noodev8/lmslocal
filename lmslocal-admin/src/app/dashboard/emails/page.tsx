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
yet" until Count is pressed, and Refresh re-runs only that card. Refresh all on the control bar
does the lot in one press, after which the cards reorder so the emails with people waiting sit at
the top and the ones with nothing to do fall below them.

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
  EmailHistoryResponse,
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
  {
    key: 'pick_reminder',
    consumer: 'Player',
    section: 'Game',
    name: 'Pick reminder',
    scoped: true,
    push: true,
    note: 'Round locks within 3 days, no pick made',
    focus: true,
    blurb:
      'A player still has no pick and their round is about to lock. The one email with a real cost behind it — a missed pick loses a life, and 20% of all player-rounds so far were NO-PICK. Once per player per round. The When column is their countdown, not an elapsed time.',
  },
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
  /*
  Game Start reminder is deliberately absent, dropped 2026-08-14 alongside Share reminder and for
  the same reason. It chased an organiser who had never pressed Ready on a competition that could
  start today. The state still occurs - 207 was created with no start block and would have
  qualified - but an organiser who has not pressed a button in a fortnight is disengaged, and
  email is what disengaged people ignore. A dashboard notice reaches them where they are looking.
  Service and template remain on disk, unwired. See services/emailCatalog.js.
  */
  /*
  Share reminder is deliberately absent. Decided against 2026-08-14, after the numbers: every
  organiser plays in their own competition, so "1 player" means nobody joined - and of the four in
  that state, two had created the competition days earlier and knew exactly when it started, while
  the two who might have forgotten had had seven weeks to recruit and hadn't. Late joining also
  turns out to happen anyway: 46% of all joins landed inside the final 48 hours across four
  competitions that ran before this email existed.

  It also pointed at the wrong remedy - "share your link" is the thing least likely to work with
  two days left, where moving the start date would. And it is the only email with an expiring
  window, so it demanded an operator at the screen on a particular evening.

  The moment is real; email is the wrong channel for it. A notice on the organiser's own dashboard
  reaches the disengaged organiser this was aimed at, with no send window. See docs/email/README.md.
  Service and template are still on disk, unwired.
  */
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
  /*
  The two hints share one service, one template and one builder - they differ only in their words
  (services/hints.js). Separate rows so each can be sent independently and email_type stays
  meaningful per hint. Unscoped because a hint teaches the ORGANISER, once ever, however many
  competitions they run - but each candidate still names the competition it picked, which is why
  the panel shows that column on recipient data rather than on `scoped`.
  */
  {
    key: 'promote_competition',
    consumer: 'Organiser',
    section: 'Info',
    name: 'Hint - Promote competition',
    scoped: false,
    note: '3 days after creating, once ever',
    focus: true,
    blurb:
      'Points an organiser at /game/[id]/promote — WhatsApp templates, social images, a QR code and the join link. Once per organiser ever, not per competition, and no more than one hint a week. Sent 3 days after creating, so it lands while they are still recruiting.',
  },
  {
    key: 'update_scores_mid_round_tip',
    consumer: 'Organiser',
    section: 'Info',
    name: 'Hint - Result set mid round',
    scoped: false,
    note: '7 days, manual comps with fixtures',
    focus: true,
    blurb:
      'Teaches entering results as matches finish rather than all at once. Organiser-managed competitions only — an automated one rejects organiser result entry outright, so the hint would be teaching a button they do not have.',
  },
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
  {
    key: 'empty_comp',
    consumer: 'Organiser',
    section: 'Info',
    name: 'Empty Competition',
    scoped: true,
    note: 'Empty after 7 days',
    focus: true,
    blurb:
      'The follow-up to Welcome Created Comp: a competition set up a week ago that nobody has joined. Asks whether they still mean to run it and invites a reply — it gives no advice, because we cannot tell from here whether they went off the idea, are waiting on someone, or are stuck on something we could fix in a sentence. One per competition ever. Counts people other than the organiser, and counts guests as players but never bots.',
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
The moment this email hangs off, relative to now. Relative rather than a date because the decision
is about distance - "2 days ago" reads as send, "7 months ago" reads as mark-as-sent, and "in 31
hours" reads as urgent, where three ISO dates all need working out. The exact timestamp is in the
title attribute for when it matters.

BOTH DIRECTIONS, because not every email hangs off something that has already happened. Most look
backwards - a join, a round settling, the last kickoff - but share_reminder hangs off a lock time
that has NOT arrived yet, and a backwards-only version rendered that as "just now" from a negative
number. Silently wrong on the one email whose whole point is a countdown.
*/
function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const future = ms < 0;
  /*
  Hours below two days, not days. Flooring to days made everything under 24h read as "today",
  which is wrong for somebody who joined last night and is the distance that matters most here.
  */
  const hours = Math.floor(Math.abs(ms) / 3_600_000);

  let span: string;
  if (hours < 1) return future ? 'within the hour' : 'just now';
  else if (hours < 48) span = `${hours} hours`;
  else {
    const days = Math.floor(hours / 24);
    if (days < 31) span = `${days} days`;
    else {
      const months = Math.floor(days / 30);
      span = months < 12 ? `${months} month${months === 1 ? '' : 's'}` : `${Math.floor(days / 365)}y+`;
    }
  }

  return future ? `in ${span}` : `${span} ago`;
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
  /* The page orders the cards by this, so the emails with people waiting come to the top. */
  onCounted,
}: {
  email: OutlineEmail;
  onOpen: () => void;
  reloadToken: number;
  onCounted: (key: string, stat: { waiting: number; sent: number }) => void;
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
        onCounted(email.key, {
          waiting: res.counts[email.key].waiting,
          sent: res.counts[email.key].sent_recently,
        });
      } else if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
        setError(res.message || 'Could not count');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}`);
    } finally {
      setLoading(false);
    }
  }, [email.key, onCounted]);

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
                  sending at all. Review is where the names behind it are. */}
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
          {/* One way in. Waiting, history, send and mark are all behind it - a second button for
              one tab of the thing this already opens was noise on every card. */}
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-900"
          >
            <EyeIcon className="h-4 w-4" />
            Review
          </button>
        </div>
      </div>
    </section>
  );
}

// ======================================================================================
// Send panel
// ======================================================================================

/*
The two questions about one email, and they are genuinely different.

  waiting  who WOULD get it if it went now. A forward-looking list that empties as it is dealt
           with, which is what makes it useless as a record.
  history  who it HAS gone to, and when. Read off email_queue, which every path writes to.

The second matters more the moment the cron takes over: nobody is watching the send, and "did it
run, and to whom" is the only question afterwards. A candidate drops out of `waiting` as soon as
it is handled, so an email that is up to date and one that never ran both show zero.
*/
type PanelTab = 'waiting' | 'history';

/*
What actually went out, in the last thirty days. Sends only.

ONLY SENDS. The tab is called Sent and shows exactly that - one question, one answer. Marked rows
outnumber real sends 105 to 3 on `welcome` and would bury them; failures and suppressions are
real but rare, and mixing four statuses under one heading meant a status column, filter chips and
a footnote explaining that most of the list was never emailed at all. All of it is still on
email_queue for db/query.js when a failure needs chasing.

THIRTY DAYS, fixed server-side, matching the card's "sent" count so the two cannot disagree.

No opens or clicks. email_tracking has the columns but nothing fills them - there is no Resend
webhook here - and a column of permanent zeros reads as "nobody opens our email" rather than "we
do not measure it".
*/
function HistoryTab({
  history,
  loading,
  onRefresh,
}: {
  history: EmailHistoryResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const rows = history?.rows ?? [];
  const sent = history?.totals?.sent ?? 0;
  /* On competition_id, not on the name: a list made entirely of deleted competitions carries no
     names and would otherwise drop the very column that says which. */
  const showCompetition = rows.some((r) => r.competition_id !== null);

  if (loading && !history) {
    return <p className="py-8 text-center text-sm text-slate-400">Reading the queue…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Nothing sent in the last 30 days.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{sent.toLocaleString()}</span>{' '}
          {sent === 1 ? 'email' : 'emails'} sent in the last 30 days
        </p>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-700 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {(
      <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Email</th>
              {showCompetition && <th className="px-3 py-2 font-semibold">Competition</th>}
              {/* No Status column - every row here is a send, which the tab already says. */}
              <th className="px-3 py-2 font-semibold">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-slate-800">
                  {r.display_name}
                  {r.round_number !== null && (
                    <span className="ml-1.5 text-xs text-slate-400">R{r.round_number}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{r.email}</td>
                {showCompetition && (
                  /*
                  The LIVE name first - that is what an operator will be searching for today, and
                  it is right even if the competition has since been renamed.

                  Falling back to the name the EMAIL carried, which template_data has stored all
                  along. The row outlives the competition (a sent email is a fact, and the LEFT
                  JOIN keeps it) and "LMS Comp, deleted" is what somebody asking about that email a
                  month later actually needs. A bare dash would have been indistinguishable from a
                  platform-wide email that never had a competition at all.
                  */
                  <td className="px-3 py-2 text-slate-500">
                    {r.competition_name ??
                      (r.competition_id !== null ? (
                        <span className="text-slate-400" title={`Competition #${r.competition_id} has since been deleted`}>
                          {r.competition_name_at_send ?? `#${r.competition_id}`}{' '}
                          {/* (x) rather than (deleted) - the column is already the widest thing on
                              the row, and the tooltip says it in full. */}
                          <span className="italic" title="Deleted">(x)</span>
                        </span>
                      ) : (
                        '—'
                      ))}
                  </td>
                )}
                {/* Absolute, not relative. "3 days ago" is the right frame for a decision about
                    whether to send; a record is read against a date somebody else has - the day a
                    player says they got nothing, or the morning the cron was meant to run. */}
                <td className="whitespace-nowrap px-3 py-2 text-slate-500" title={relativeTime(r.at)}>
                  {new Date(r.at).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {history?.truncated && (
          <p className="border-t border-slate-100 px-3 py-2 text-xs italic text-slate-400">
            Newest {rows.length} of {sent.toLocaleString()} shown.
          </p>
        )}
      </div>
      )}
    </>
  );
}

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
  /* Always opens on Waiting - the panel is opened to do something, and history is a click away. */
  const [tab, setTab] = useState<PanelTab>('waiting');
  const [preview, setPreview] = useState<PreviewEmailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* History, loaded on its own and only once its tab has been opened. */
  const [history, setHistory] = useState<EmailHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      /* Sends only. The other statuses are still on email_queue for whoever needs to chase one. */
      const res = await adminApi.getEmailHistory(email.key, scopeId, 'sent');
      if (res.return_code === 'SUCCESS') {
        setHistory(res);
      } else if (res.return_code !== 'UNAUTHORIZED' && res.return_code !== 'TOKEN_EXPIRED') {
        setError(res.message || 'Could not read the history');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}`);
    } finally {
      setHistoryLoading(false);
    }
  }, [email.key, scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Not on mount - the history is a second query and only the tab that is open should pay for it.
     Re-runs on a filter change, and after a send, since that is when it has changed. */
  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  const count = preview?.recipient_count ?? 0;
  const recipients: EmailRecipient[] = useMemo(() => preview?.recipients ?? [], [preview]);

  const allSelected = recipients.length > 0 && selected.size === recipients.length;

  /*
  Show the competition column when the recipients actually carry one, rather than when the email
  is `scoped`. The two are not the same: a hint is per-organiser (scoped: false) but still names
  one of their competitions, and keying off scoped hid exactly the thing that says which.
  */
  const showCompetition = recipients.some((r) => r.competition_name);

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

        {/*
        Two tabs rather than two screens. They are the same email and the same scope, and the
        judgement the operator is making moves between them constantly: "has this one had it
        already?" is a history question asked in the middle of a send.
        */}
        {/*
        NO COUNTS ON THE TABS. They arrive from two different queries at two different moments, so
        a badge appearing after the fact resized the tab, shifted the one beside it and moved the
        panel under the cursor of whoever had just pressed it. Each tab states its own numbers in
        its own body, where the content is already changing.
        */}
        <div className="flex gap-1 border-b border-slate-200 px-5">
          {([
            { id: 'waiting' as const, label: 'Waiting' },
            { id: 'history' as const, label: 'Sent' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* A floor under the body so switching tabs, or a list arriving, cannot collapse the panel
            and walk the buttons up the screen. */}
        <div className="min-h-[22rem] space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          {tab === 'history' ? (
            <HistoryTab
              history={history}
              loading={historyLoading}
              onRefresh={loadHistory}
            />
          ) : loading ? (
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
                          {showCompetition && <th className="px-3 py-2 font-semibold">Competition</th>}
                          {/* "When", not "Waiting since": some emails hang off something still
                              to come, and this column reads both ways. */}
                          <th className="px-3 py-2 font-semibold">When</th>
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
                            {showCompetition && (
                              <td className="px-3 py-2 text-slate-500">{r.competition_name ?? '—'}</td>
                            )}
                            {/* The judgement this screen exists for: a join from yesterday is a
                                send, one from January is a mark-as-sent, and a deadline in 31
                                hours is a send now. */}
                            <td
                              className="px-3 py-2 whitespace-nowrap text-slate-500"
                              title={r.since ? new Date(r.since).toLocaleString() : undefined}
                            >
                              {relativeTime(r.since)}
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
          {tab === 'waiting' && email.focus && count > 0 && (
            <button
              onClick={handleMark}
              disabled={busy || nothingChosen}
              title="Mark the ticked rows as sent without emailing anyone"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark {chosen.length} as sent
            </button>
          )}

          {/* The history tab is a record, not a control. Nothing on it can be acted on, so the
              send button is absent rather than disabled - a greyed-out send invites a hunt for
              what would enable it. */}
          {tab === 'waiting' && (
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
          )}
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

  /* What each card last counted, reported back as it counts. Only used for the ordering below. */
  const [stats, setStats] = useState<Record<string, { waiting: number; sent: number }>>({});
  const noteCount = useCallback(
    (key: string, stat: { waiting: number; sent: number }) => setStats((prev) => ({ ...prev, [key]: stat })),
    []
  );

  /*
  ONLY REFRESH ALL REORDERS. The cards are counted asynchronously, so sorting on every count made a
  card jump under the cursor of whoever had just pressed its own Count button - and moving the
  thing somebody is looking at is worse than a stale order.

  So `order` is a snapshot, taken once every card has reported after a Refresh all, and nothing
  else touches it. An empty snapshot is outline order.
  */
  const [order, setOrder] = useState<string[]>([]);
  const [pendingSort, setPendingSort] = useState(false);

  useEffect(() => {
    if (!pendingSort || FOCUS.some((e) => stats[e.key] === undefined)) return;
    setOrder(
      FOCUS.map((e, index) => ({ key: e.key, index, ...stats[e.key] }))
        /* Waiting first - the screen becomes a queue of work. Then `sent`, so that among the
           emails with nobody waiting the ones actually running sit above the ones that have never
           sent anything, which is the difference between caught up and not wired up. */
        .sort((a, b) => b.waiting - a.waiting || b.sent - a.sent || a.index - b.index)
        .map((row) => row.key)
    );
    setPendingSort(false);
  }, [pendingSort, stats]);

  const orderedFocus = useMemo(() => {
    if (order.length === 0) return FOCUS;
    return [...FOCUS].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }, [order]);

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

  /*
  Count everything. Ten cards is ten candidate queries at roughly 24ms each - about a quarter of a
  second, and the same total work as pressing every card's own button. Cheap enough that arriving
  at the screen and counting the lot is the normal way in; the per-card button is what stops an
  action on one card paying for the other nine.
  */
  const refreshCounts = () => {
    if (REMAINING.length > 0 && competitionId !== null) loadCounts(competitionId);
    /* The one gesture that reorders. Applied once every card has reported back. */
    setPendingSort(true);
    setReloadTokens((prev) => {
      const next = { ...prev };
      for (const e of FOCUS) next[e.key] = (next[e.key] ?? 0) + 1;
      return next;
    });
  };

  /* Only the card that was acted on. A send from one card cannot change another's count. */
  const refreshCard = (key: string) =>
    setReloadTokens((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));

  return (
    <div className="min-h-screen">
      {/* Refresh all, the live switch and Broadcast are on the control bar below rather than up
          here: they are this screen's controls, not navigation, and in the nav bar they read as
          chrome and sat at a lower priority than the live switch they belong beside. */}
      <AdminHeader />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {/*
        THE CONTROL BAR. The three things an operator does on arriving - refresh the numbers, arm
        or disarm sending, write a broadcast - sit together at the same size, because they are the
        same kind of decision. Two of them used to be small buttons in the nav bar, which read as
        chrome rather than as the controls for this screen.

        Colour is carried by the mode strip and the live label alone. A full red panel behind all
        three made the other two look like part of the warning.
        */}
        <div className="flex flex-wrap items-stretch gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className={`w-1 shrink-0 ${testMode ? 'bg-amber-400' : 'bg-red-500'}`} />

          <div className="flex min-w-[16rem] flex-1 items-center gap-2.5 py-3">
            {testMode ? (
              <BeakerIcon className="h-5 w-5 shrink-0 text-amber-600" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <div className="text-sm">
              {testMode ? (
                <>
                  <p className="font-medium text-slate-900">Test mode on</p>
                  <p className="text-slate-500">One copy to the test address. Nothing queued, nobody touched.</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-red-800">Live sending</p>
                  <p className="text-slate-500">Emails go to real people. Resets to test on refresh.</p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button
              onClick={refreshCounts}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh all
            </button>

            <button
              onClick={() => setTestMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                testMode
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  : 'border-red-600 bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {testMode ? <ExclamationTriangleIcon className="h-4 w-4" /> : <BeakerIcon className="h-4 w-4" />}
              {testMode ? 'Switch to live' : 'Back to test'}
            </button>

            {/* Broadcast has its own screen: it carries typed text and needs an audience count and
                a confirmation before sending, which would be noise on every card here. */}
            <Link
              href="/dashboard/emails/broadcast"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <MegaphoneIcon className="h-4 w-4" />
              Broadcast
            </Link>
          </div>
        </div>

        {/* ============================================================================
            One card per email taken up so far. Each counts itself, on request.
            ============================================================================ */}
        {orderedFocus.map((email) => (
          <FocusCard
            key={email.key}
            email={email}
            reloadToken={reloadTokens[email.key] ?? 0}
            onCounted={noteCount}
            onOpen={() => setOpen({ email, scopeAll: true })}
          />
        ))}

        {/*
        The picker and the table below only exist for emails that have not been taken up yet.
        Every email now has a card, so REMAINING is empty and both disappear - rather than leaving
        a dropdown that narrows nothing above a table with only headers in it. They come back on
        their own if an email is ever added to the outline without a card.
        */}
        {REMAINING.length > 0 && (
          <>
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
          </>
        )}
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
