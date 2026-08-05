/*
 * Pools-coupon tokens for the print/social artwork.
 *
 * These MUST stay in step with lmslocal-web/tailwind.config.js — a leaflet whose
 * red is a shade off the website's red is worse than no leaflet. If the app's
 * tokens change, change them here too. This file is a deliberate duplicate
 * rather than an import: the marketing pages have no build step, so they cannot
 * read the app's config, and giving them one would couple print artwork to the
 * app's release cycle.
 *
 * Load AFTER the Tailwind Play CDN script and BEFORE any markup that uses the
 * classes — the CDN reads `tailwind.config` when it first scans the document.
 */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        'stock-deep': '#CDD3C4',
        stock: '#DDE1D6',
        'stock-lit': '#F2F3EC',
        ink: '#1C2620',
        'ink-fade': '#4A5249',
        overprint: '#C8341E',
        moss: '#2F4B32',
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'ui-sans-serif', 'sans-serif'],
        body: ['"Instrument Sans"', 'ui-sans-serif', 'sans-serif'],
        data: ['"Courier Prime"', 'ui-monospace', 'monospace'],
      },
    },
  },
};

// Injected rather than pasted into every page's <head> so there is one place to
// change the weights if a headline needs a heavier cut.
document.write(
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2' +
    '?family=Big+Shoulders+Display:wght@400;600;700;800' +
    '&family=Instrument+Sans:wght@400;500;600' +
    '&family=Courier+Prime:wght@400;700' +
    '&display=swap">'
);
