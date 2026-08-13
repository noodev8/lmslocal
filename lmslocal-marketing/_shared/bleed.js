/*
 * Print-shop bleed mode, opt-in via `?bleed` on the URL.
 *
 * The leaflets are edge-to-edge — the tinted stock IS the design — so at exact
 * trim size any drift in the guillotine (±1mm is normal) leaves a white sliver
 * down one edge. A commercial printer wants the sheet 3mm larger on every side
 * with the artwork running into that margin, then trims it off.
 *
 * It is opt-in rather than the default because the two outputs are for two
 * different machines. An office printer handed a 154x216mm page scales it to
 * fit A4 and adds its own margin, which loses the edge-to-edge ground entirely.
 * So the plain file stays the one you print yourself, and only the copy you
 * hand to a print shop carries bleed.
 *
 * The geometry is measured rather than hardcoded: the content box is unchanged
 * (the sheet grows 3mm per side, the safe padding grows 3mm to match), so the
 * layout is identical in both modes and there is no second set of numbers to
 * keep in step. A future DL or A4 sheet gets bleed from this file for free.
 *
 * No crop marks: there is no room for them inside a 3mm bleed, and print shops
 * impose their own marks anyway. Tell them "154 x 216mm, 3mm bleed, trims to
 * A5" and that is the whole handoff.
 *
 * Load at the END of <body> — it reads the laid-out size of .sheet, and it
 * appends its rules after the page's own <style> so they win on source order.
 */
(function () {
  'use strict';

  var BLEED_MM = 3;

  if (!/[?&]bleed(?:[=&]|$)/.test(location.search)) return;

  var sheet = document.querySelector('.sheet');
  var safe = document.querySelector('.safe');
  if (!sheet) return;

  // Measure how many CSS pixels a millimetre is worth, so the sheet can be read
  // back in mm. Browser zoom scales the probe and the sheet identically, so the
  // ratio holds either way.
  var probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:100mm';
  document.body.appendChild(probe);
  var pxPerMm = probe.getBoundingClientRect().width / 100;
  probe.parentNode.removeChild(probe);

  var rect = sheet.getBoundingClientRect();
  var pageW = Math.round(rect.width / pxPerMm) + BLEED_MM * 2;
  var pageH = Math.round(rect.height / pxPerMm) + BLEED_MM * 2;

  var rules =
    '@page { size: ' + pageW + 'mm ' + pageH + 'mm; margin: 0 }' +
    '.sheet { width: ' + pageW + 'mm; height: ' + pageH + 'mm }';

  if (safe) {
    var padMm = parseFloat(getComputedStyle(safe).paddingTop) / pxPerMm;
    rules += '.safe { padding: ' + (Math.round(padMm) + BLEED_MM) + 'mm }';
  }

  var style = document.createElement('style');
  style.textContent = rules;
  document.head.appendChild(style);

  // Drives the screen-only trim guide in print.css.
  document.body.style.setProperty('--bleed', BLEED_MM + 'mm');
  document.body.classList.add('bleed');

  // Rewrite the print instructions, because they differ from the home-printer
  // ones and a sheet printed with the wrong ones is silently wrong rather than
  // obviously wrong.
  var note = document.querySelector('.screen-only');
  if (note) {
    note.innerHTML =
      '<strong>Print-shop copy — ' +
      pageW +
      ' × ' +
      pageH +
      'mm with ' +
      BLEED_MM +
      'mm bleed, trims to ' +
      (pageW - BLEED_MM * 2) +
      ' × ' +
      (pageH - BLEED_MM * 2) +
      'mm.</strong> ' +
      'Ctrl+P → Save as PDF · margins <strong>None</strong> · ' +
      '<strong>Background graphics ticked</strong> · ' +
      '<strong>Headers and footers unticked</strong>. ' +
      'Open the saved PDF and check the page really is ' +
      pageW +
      ' × ' +
      pageH +
      'mm before sending it — if Chrome forced a paper size it will have scaled the sheet. ' +
      'The red dashes are the trim line. ' +
      '<a class="underline" href="' +
      location.pathname +
      '">Back to the home-printer version.</a>';
  }
})();
