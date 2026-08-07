import { LABEL } from '@/lib/design';

/*
Marks a bot in any player list.

Bots used to disclose themselves through a "Bot " name prefix, which read as clutter once a
competition held twenty of them. The chip carries the same fact in less space, survives
truncation (a prefix does not), and stays put when a list is sorted by name.

That makes it the only bot disclosure a player ever sees, so it has to appear on every surface
that lists names - and each of those surfaces needs its API to return `is_bot`, which is derived
from the bot email pattern in services/botPool.js. A screen that forgets it shows bots as
ordinary people.

Deliberately quieter than the "You" chip: it is a footnote about the row, not the point of it.
*/
export default function BotChip() {
  return (
    <span className={`${LABEL} shrink-0 border border-ink/40 px-1.5 py-0.5 text-ink-fade`}>
      Bot
    </span>
  );
}
