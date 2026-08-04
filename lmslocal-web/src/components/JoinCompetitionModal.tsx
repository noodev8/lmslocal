'use client';

import { useState } from 'react';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { LABEL, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';

interface JoinCompetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (inviteCode: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export default function JoinCompetitionModal({
  isOpen,
  onClose,
  onJoin,
  isLoading = false,
  error = null
}: JoinCompetitionModalProps) {
  const [inviteCode, setInviteCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.trim()) {
      onJoin(inviteCode.trim());
    }
  };

  const handleClose = () => {
    setInviteCode('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className={`${PANEL} w-full max-w-md p-6`}>
        <form onSubmit={handleSubmit}>
          <h3 className={`${HEADING} text-2xl`}>Join competition</h3>
          <p className="mt-2 text-[15px] text-ink-fade">
            Enter the invite code shared by the competition organiser
          </p>

          <label htmlFor="invite-code" className={`${LABEL} mb-2 mt-5 block text-ink-fade`}>
            Invite code
          </label>
          <input
            type="text"
            id="invite-code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="w-full rounded-sm border border-ink bg-transparent px-3 py-2 font-data text-lg tracking-widest text-ink placeholder-ink-fade/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            placeholder="ABC123"
            disabled={isLoading}
            autoFocus
          />

          {error && (
            <div className="mt-4 border border-overprint px-3 py-2">
              <p className="text-[15px] text-ink">{error}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className={`${BTN_OUTLINE} px-4 py-2 disabled:opacity-50`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !inviteCode.trim()}
              className={`${BTN_PRIMARY} inline-flex items-center justify-center gap-2 px-4 py-2 text-base disabled:opacity-50`}
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-stock-lit border-t-transparent" />
                  Joining...
                </>
              ) : (
                <>
                  <UserGroupIcon className="h-5 w-5" />
                  Join competition
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
