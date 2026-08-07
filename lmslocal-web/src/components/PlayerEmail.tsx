import { LABEL } from '@/lib/design';

/*
The email line under a player's name on the organiser's players screen.

Two things are going on here, for two different reasons.

Generated addresses are hidden outright. add-offline-player.js mints `{id}@lms-guest.com` for a
guest, and bots carry `bot_<name>@lms-guest.com` - neither is contact information, so printing
them just puts noise where a real address would be.

Real addresses are masked, with no way to unmask them here. The masked form is enough for what
the organiser actually needs it for: confirming an address with a player they are already
speaking to. Nothing on this screen sends email, so the full string has no job to do on it.

This is deliberately not access control - the address is still in the get-competition-players
response and anyone technical can read it there. What it removes is the incidental exposure: the
screen photographed in a pub, shared in a screenshot, or read over a shoulder, with every
player's address on it at once. That matters more than usual because manage-players permission
can be delegated to another player (organizer-update-player-permissions), so this list is not
only ever seen by the competition owner.

Search still matches on the full address server-side, so masking costs no operational ability.
*/

/** Generated placeholder addresses, not real contact details. */
function isGeneratedEmail(email?: string | null): boolean {
  return !email || email.endsWith('@lms-guest.com');
}

/** `dave.smith@gmail.com` -> `d••••••••@gmail.com`. Domain kept: it identifies without exposing. */
function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•'.repeat(email.length);

  const local = email.slice(0, at);
  const domain = email.slice(at);

  // A single-character local part has nothing to keep - mask it whole rather than print it plain.
  const shown = local.length > 1 ? local[0] : '';
  return `${shown}${'•'.repeat(Math.max(local.length - shown.length, 2))}${domain}`;
}

interface PlayerEmailProps {
  email?: string | null;
  isBot?: boolean;
}

export default function PlayerEmail({ email, isBot }: PlayerEmailProps) {
  // The Bot chip beside the name already says what this row is.
  if (isBot) return null;

  if (isGeneratedEmail(email)) {
    return <p className={`${LABEL} text-ink-fade`}>Guest &mdash; no email</p>;
  }

  return <p className="truncate font-data text-[13px] text-ink-fade">{maskEmail(email as string)}</p>;
}
