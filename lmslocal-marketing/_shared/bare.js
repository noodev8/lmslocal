/*
 * Screenshot mode, opt-in via `?bare` on the URL.
 *
 * The social tiles are exported by hand — DevTools, capture the .tile node — and
 * social.css gives them a grey desk and an instruction line so there is something
 * to look at while you work. That is right for a tile a person eyeballs and
 * uploads once.
 *
 * The OG images are not that. They are a build output: a file in
 * lmslocal-web/public/ that has to be exactly 1200x630, regenerated whenever the
 * copy changes, by a script rather than a hand. make-png.js sizes the browser
 * window to the tile and captures the viewport, which is only equal to the tile
 * if nothing else is on the page — so `?bare` removes the desk, the padding and
 * the note.
 *
 * Capturing the viewport rather than the node is deliberate: it is the one
 * measurement Chrome will not silently round, and an OG image that comes out
 * 1198px wide is rejected by nothing and looks wrong everywhere.
 *
 * Load at the END of <body>, after the markup it hides.
 */
(function () {
  'use strict';

  if (!/[?&]bare(?:[=&]|$)/.test(location.search)) return;

  var style = document.createElement('style');
  style.textContent =
    'body { margin: 0 !important; padding: 0 !important; background: none !important;' +
    ' display: block !important; gap: 0 !important }' +
    '.screen-only { display: none !important }';
  document.head.appendChild(style);
})();
