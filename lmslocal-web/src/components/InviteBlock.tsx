'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';
import { joiningOpen } from '@/lib/roundState';
import { buildInviteMessage, buildJoinUrl } from '@/lib/templates';
import { formatLockTime } from '@/components/StartDateChooser';

/**
 * The link that gets people into the competition, on the screen they are already looking at.
 *
 * The web half of the Flutter app's `InviteBlock` (`lib/presentation/pages/competition/widgets/
 * invite_block.dart`) — same order, same copy, same rules, so an organiser who does this on the
 * phone one week and the laptop the next is doing the same thing twice. The message itself comes
 * from `buildInviteMessage`, which both codebases are ported from; change the `pre_launch_1`
 * template and Dart's `invite.dart` follows.
 *
 * **Shown to players, not just organisers.** A player bringing their own mates in is good for the
 * competition. When that becomes a setting the organiser chooses, this is where the gate goes.
 *
 * Only while joining is open. The code outlives the competition, so an invitation sent after
 * round 1 locks leads someone to a door that will not open — see `joiningOpen`.
 *
 * The deliberately smaller half of `/promote`, which keeps the templates, the generated images
 * and the printable leaflet. This is the part you need in your hand.
 */
export default function InviteBlock({
  competitionName,
  inviteCode,
  isOrganiser,
  currentRound,
  lockTime,
  entryFee,
  prizeStructure,
  onToast,
}: {
  competitionName: string;
  inviteCode: string | null | undefined;
  isOrganiser: boolean;
  currentRound: number | null | undefined;
  lockTime: string | null | undefined;
  entryFee?: number | string | null;
  prizeStructure?: string | null;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showLargeQr, setShowLargeQr] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const joinUrl = inviteCode ? buildJoinUrl(inviteCode) : '';

  useEffect(() => {
    if (!joinUrl) return;
    // 'H' error correction because this ends up photographed off a screen and stuck on a poster
    // rather than scanned from a pristine display — same reasoning as /promote and the app.
    QRCode.toDataURL(joinUrl, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      // The link is shown above it, so a missing QR costs a convenience rather than the ability
      // to share.
      .catch((error) => console.error('Error generating join QR code:', error));
  }, [joinUrl]);

  // Escape closes the enlarged QR. It is held up for a few seconds, not a place to be, so every
  // obvious way out has to work.
  useEffect(() => {
    if (!showLargeQr) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowLargeQr(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showLargeQr]);

  if (!inviteCode) return null;
  if (!joiningOpen({ currentRound, currentRoundLockTime: lockTime, now: new Date() })) return null;

  const inviteMessage = buildInviteMessage({
    competition_name: competitionName,
    join_url: joinUrl,
    lock_time: lockTime,
    entry_fee: entryFee,
    prize_structure: prizeStructure,
  });

  /**
   * The share sheet, carrying the full invitation rather than a bare link — WhatsApp is where
   * these actually go, and that is one tap from here.
   *
   * Most desktop browsers have no share sheet, so without one the button copies the same message
   * instead. A cancelled share is silent: the user meant to cancel, and a toast would read as a
   * failure.
   */
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${competitionName} — Last Man Standing`, text: inviteMessage });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return;
        // Anything else — a browser that lists share but refuses this payload — falls through to
        // the clipboard rather than leaving the button dead.
      }
    }
    await navigator.clipboard.writeText(inviteMessage);
    onToast('Message copied! Paste it into WhatsApp, email, or any messaging app', 'success');
  };

  return (
    <div className={`${PANEL} p-6`}>
      <div className="text-center">
        <p className={EYEBROW}>{isOrganiser ? 'Setup' : 'Spread the word'}</p>
        <p className={`${HEADING} mt-1 text-2xl`}>{isOrganiser ? 'Invite players' : 'Invite a friend'}</p>

        {/* The deadline, said out loud, on the screen where recruiting actually happens. Joining
            closes when round 1 locks - everyone has to start together, or a late joiner would face
            opponents who had already burned teams. Nothing used to say so, which is why an
            organiser could spend a week recruiting without knowing there was a clock on it. */}
        <p className="mt-2 text-[13px] text-ink-fade">
          {lockTime ? (
            <>
              Joining closes <span className="text-ink">{formatLockTime(lockTime)}</span>, when round 1
              locks. After that the competition is closed.
            </>
          ) : (
            'Anyone with the link can join until round 1 locks.'
          )}
        </p>
      </div>

      {/* The link comes first and the code second: someone sent a link never has to type
          anything, which is the whole point of docs/player-onboarding.md §2. The code is still
          here for anyone told it out loud. */}
      <div className="mt-5 border-t border-ink/30 pt-5 text-center">
        <p className="text-[15px] text-ink-fade">
          {isOrganiser ? 'Send players this link' : 'Send them this link'}
        </p>
        <p className="mt-2 break-all font-data text-[15px] text-ink">{joinUrl}</p>

        {/* The QR under the link it encodes. Clicking fills the screen, because the whole point of
            a QR is someone else's phone pointing at this one from across a table. */}
        {qrDataUrl && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setShowLargeQr(true)}
              className="border border-ink/30 bg-white p-2"
              aria-label="Enlarge the join QR code"
            >
              <Image src={qrDataUrl} alt="QR code linking to the join page" width={92} height={92} unoptimized />
            </button>
            <p className="max-w-[16rem] text-left text-[13px] text-ink-fade">
              Click to enlarge. Whoever scans it goes straight to the join page &mdash; nothing to type.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button onClick={handleShare} className={`${BTN_PRIMARY} px-5 py-2.5 text-base`}>
            Share
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(joinUrl);
              setLinkCopied(true);
              onToast('Join link copied', 'success');
              setTimeout(() => setLinkCopied(false), 2000);
            }}
            className={`${BTN_OUTLINE} px-3 py-1.5`}
          >
            {linkCopied ? 'Copied' : 'Copy link'}
          </button>
        </div>

        {/* The code is the fallback for someone being told it over a bar, not the main route - the
            link carries the code already, so leading with both would offer a choice nobody needs. */}
        <p className="mt-4 text-[13px] text-ink-fade">
          Or give them the code <code className="font-data text-[15px] text-ink">{inviteCode}</code> to
          enter at lmslocal.co.uk
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteCode);
              setCodeCopied(true);
              onToast('Competition code copied to clipboard!', 'success');
              setTimeout(() => setCodeCopied(false), 2000);
            }}
            className="ml-2 underline underline-offset-2 hover:text-ink"
          >
            {codeCopied ? 'Copied' : 'Copy code'}
          </button>
        </p>
      </div>

      {/* The QR at scanning size. Dismissable by clicking anywhere: someone holding a laptop or a
          phone out is not looking for a close button. The name goes above it because whoever is
          pointing a camera at this has often been told a name and nothing else, and the code below
          covers the person whose camera will not scan. */}
      {showLargeQr && qrDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
          onClick={() => setShowLargeQr(false)}
        >
          <div className={`${PANEL} w-full max-w-sm p-6 text-center`}>
            <p className={`${HEADING} text-2xl`}>{competitionName}</p>
            <div className="mt-5 inline-block border border-ink/30 bg-white p-3">
              <Image src={qrDataUrl} alt="QR code linking to the join page" width={240} height={240} unoptimized />
            </div>
            <p className={`${LABEL} mt-5 text-ink-fade`}>Scan to join</p>
            <p className="mt-1 font-data text-xl tracking-wider text-ink">{inviteCode}</p>
          </div>
        </div>
      )}
    </div>
  );
}
