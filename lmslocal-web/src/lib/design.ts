/**
 * Shared class strings for the "pools coupon" design system.
 *
 * Full rationale, colour and type rules, and the component catalogue live in
 * docs/design-system.md. Import from here rather than retyping the strings, so
 * that a change to a label or a button lands everywhere at once.
 *
 * Colour and font tokens themselves are Tailwind theme extensions — see
 * tailwind.config.js for stock / stock-deep / stock-lit / ink / ink-fade /
 * overprint and the display / body / data font families.
 */

/** Utility label: nav items, buttons, captions, field labels, chips. */
export const LABEL = 'font-body text-xs font-semibold uppercase tracking-[0.12em]';

/** Section eyebrow, sitting above a display heading. One step wider than LABEL. */
export const EYEBROW = 'font-body text-xs font-semibold uppercase tracking-[0.16em]';

/** Display heading base. Add a size class — text-4xl through text-7xl. */
export const HEADING = 'font-display font-semibold uppercase leading-[0.9] text-ink';

/** A lifted panel on any ground: the sheet, the docket, the two-ways cards. */
export const PANEL = 'border border-ink/30 bg-stock-lit';

/** Primary action. On an ink ground swap the focus ring to outline-stock. */
export const BTN_PRIMARY =
  'rounded-sm bg-overprint font-display uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** Secondary action on a light ground. */
export const BTN_OUTLINE = `${LABEL} rounded-sm border border-ink px-3.5 py-2 text-ink transition-colors hover:bg-ink hover:text-stock-lit`;

/** Ink-filled action, for a solid button that isn't the screen's one `overprint` primary — e.g. a "Manage" action repeated once per card. */
export const BTN_DARK =
  'rounded-sm bg-ink font-display uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** Tick box glyph wrapper for checklist items. Pair with &#10003;. */
export const TICK =
  'inline-flex h-[18px] w-[18px] flex-none translate-y-[3px] items-center justify-center border border-ink/60 text-[12px] font-bold leading-none text-overprint';

/** Hairline rule used for section and row dividers. */
export const RULE = 'border-ink/30';
