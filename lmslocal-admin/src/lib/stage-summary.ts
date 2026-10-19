import { StagePushOutcome } from '@/lib/api';

/*
What staging a block did, in one line - shared by Stage on the calendar and by closing a gameweek,
which stages the next block itself, so both say it the same way.

Skipped competitions are named with their reason because "why didn't that one get its fixtures?"
is the next question, and the answer is usually an organiser who has not pressed Ready - normal,
not a fault. Only a failure, or a push that never ran, counts as one.
*/
export function describeStage(
  label: string,
  competitions: StagePushOutcome[] | null
): { failed: boolean; text: string } {
  if (competitions === null) {
    return {
      failed: true,
      text: `"${label}" is staged, but sending it to competitions did not run. Push them from the Fixtures screen.`,
    };
  }

  const pushed = competitions.filter((c) => c.outcome === 'pushed').length;
  const notSent = competitions
    .filter((c) => c.outcome !== 'pushed')
    .map((c) => `${c.name} (${c.reason ?? 'not sent'})`);

  return {
    failed: competitions.some((c) => c.outcome === 'failed'),
    text:
      `"${label}" is staged and sent to ${pushed} of ${competitions.length} competition${competitions.length === 1 ? '' : 's'}.` +
      (notSent.length > 0 ? ` Not sent: ${notSent.join('; ')}.` : ''),
  };
}
