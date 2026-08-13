/*
 * Turn a leaflet into a PDF a print shop will accept.
 *
 *   node make-pdf.js a5-player-1992
 *
 * That is the whole thing. The file lands in out/ and is ready to upload.
 *
 * Add --home for a copy to print on your own printer instead (no bleed, keeps
 * the fonts as fonts):
 *
 *   node make-pdf.js a5-player-1992 --home
 *
 * ---------------------------------------------------------------------------
 * Why this script exists rather than "just press Ctrl+P":
 *
 * Printing by hand needs four dialog settings right, and gets two things wrong
 * that are invisible until it is too late.
 *
 *  1. Opening a leaflet as a file:// page silently fails to load two of the
 *     three brand fonts, and Chrome quietly substitutes Arial. The leaflet
 *     still looks fine, so it passes the eye and prints wrong. Serving the
 *     folder over http fixes it, so this script runs a throwaway local server
 *     and prints from that.
 *
 *  2. Print shops reject live fonts and want the text as outlines — vector
 *     shapes rather than characters. Ghostscript does that conversion; there
 *     is no way to do it from Chrome's dialog.
 *
 * Print mode also uses the ?bleed variant, which grows the sheet 3mm on every
 * side so the guillotine has something to cut into. See _shared/bleed.js.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Chrome must be run asynchronously, not with spawnSync: the local server below
// lives in this same process, so blocking the event loop means Chrome asks for
// the page and nothing ever answers it.
function run(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'ignore' });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ error });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code });
    });
  });
}

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const PORT = 8117; // Unlikely to collide; nothing else in this repo uses it.

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

/* --- locate Chrome and Ghostscript ---------------------------------------- */

function findChrome() {
  const candidates = [
    path.join(process.env['ProgramFiles'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['LOCALAPPDATA'] || '', 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

// Ghostscript's folder carries its version, so glob rather than hardcode —
// otherwise this breaks on the next Ghostscript update.
function findGhostscript() {
  for (const base of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']]) {
    const dir = base && path.join(base, 'gs');
    if (!dir || !fs.existsSync(dir)) continue;
    for (const v of fs.readdirSync(dir).sort().reverse()) {
      for (const exe of ['gswin64c.exe', 'gswin32c.exe']) {
        const full = path.join(dir, v, 'bin', exe);
        if (fs.existsSync(full)) return full;
      }
    }
  }
  for (const p of ['/usr/bin/gs', '/usr/local/bin/gs', '/opt/homebrew/bin/gs']) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/* --- main ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const home = args.includes('--home');
const name = args.find((a) => !a.startsWith('--'));

if (!name) {
  console.error('Usage: node make-pdf.js <leaflet-name> [--home]');
  console.error('Leaflets available:');
  for (const f of fs.readdirSync(path.join(ROOT, 'leaflet')).filter((f) => f.endsWith('.html'))) {
    console.error('  ' + f.replace(/\.html$/, ''));
  }
  process.exit(1);
}

const source = path.join(ROOT, 'leaflet', name + '.html');
if (!fs.existsSync(source)) {
  console.error(`No such leaflet: ${source}`);
  process.exit(1);
}

const chrome = findChrome();
if (!chrome) {
  console.error('Could not find Chrome. Install it, or edit findChrome() in this file.');
  process.exit(1);
}

const gs = findGhostscript();
if (!gs && !home) {
  console.error('Could not find Ghostscript, which is needed to convert text to outlines.');
  console.error('Install it from https://ghostscript.com/releases/gsdnld.html and re-run,');
  console.error('or use --home for a PDF to print yourself.');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const stamp = new Date().toISOString().slice(0, 10);
const finalPdf = path.join(OUT, home ? `${name}-home.pdf` : `${stamp}-${name}-print.pdf`);
const rawPdf = path.join(os.tmpdir(), `lms-${Date.now()}.pdf`);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-chrome-'));

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  fs.readFile(file, (err, buf) => {
    if (err) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, async () => {
  const url = `http://localhost:${PORT}/leaflet/${name}.html${home ? '' : '?bleed'}`;
  console.log(`${home ? 'Home' : 'Print-shop'} copy of ${name}`);
  console.log('  rendering ...');

  const r = await run(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      // Its own throwaway profile. Without this, Chrome sees the copy you
      // already have open, hands the job to it and never exits.
      `--user-data-dir=${profileDir}`,
      '--disable-extensions',
      '--hide-scrollbars',
      '--no-pdf-header-footer', // Otherwise Chrome stamps the URL and date on the sheet.
      '--print-to-pdf-no-header',
      // Do NOT add --virtual-time-budget here. It looks like the right way to
      // wait for the webfonts, but it makes new-headless Chrome hang forever
      // instead of exiting. Chrome already waits for the fonts on its own.
      `--print-to-pdf=${rawPdf}`,
      url,
    ],
    // Never hang: a wedged Chrome should fail loudly rather than sit there.
    120000
  );

  server.close();

  if (r.error || !fs.existsSync(rawPdf)) {
    console.error('Chrome failed to produce a PDF.', r.error || '');
    process.exit(1);
  }

  if (home) {
    fs.copyFileSync(rawPdf, finalPdf);
    fs.unlinkSync(rawPdf);
    done();
    return;
  }

  console.log('  converting text to outlines ...');
  const g = await run(
    gs,
    [
      '-dNOPAUSE',
      '-dBATCH',
      '-sDEVICE=pdfwrite',
      '-dNoOutputFonts', // The bit print shops are asking for.
      '-dAutoRotatePages=/None',
      // Leave the QR alone. Downsampling it is the one change that could stop
      // the code scanning, and a leaflet whose QR fails is worse than no leaflet.
      '-dDownsampleColorImages=false',
      '-dDownsampleGrayImages=false',
      '-dDownsampleMonoImages=false',
      '-dColorConversionStrategy=/LeaveColorUnchanged',
      `-sOutputFile=${finalPdf}`,
      rawPdf,
    ],
    120000
  );
  fs.unlinkSync(rawPdf);

  if (g.error || !fs.existsSync(finalPdf)) {
    console.error('Ghostscript failed.', g.error || '');
    process.exit(1);
  }
  done();
});

function done() {
  // Read the page size back out of the finished file rather than trusting that
  // the settings above did what they were meant to.
  const txt = fs.readFileSync(finalPdf, 'latin1');
  const box = /\/MediaBox\s*\[([^\]]*)\]/.exec(txt);
  let size = 'unknown';
  if (box) {
    const n = box[1].trim().split(/\s+/).map(Number);
    size = `${((n[2] / 72) * 25.4).toFixed(0)} x ${((n[3] / 72) * 25.4).toFixed(0)} mm`;
  }
  const fonts = (txt.match(/\/FontFile/g) || []).length;

  console.log('');
  console.log('  ' + finalPdf);
  console.log(`  ${(fs.statSync(finalPdf).size / 1024).toFixed(0)} KB · ${size}`);
  if (!home) {
    console.log(`  fonts left in file: ${fonts}${fonts === 0 ? ' (correct)' : ' — SHOULD BE 0'}`);
    console.log('');
    console.log('  Upload that to the print shop. It trims to A5; the extra 3mm');
    console.log('  on each side is bleed and gets cut off.');
  }
  console.log('');
  console.log('  Check the QR scans by pointing your phone at the PDF on screen.');
}
