/*
 * Render a fixed-size tile to a PNG.
 *
 *   node make-png.js og-join
 *   node make-png.js og-default
 *
 * Run it with no arguments to list what is available.
 *
 * ---------------------------------------------------------------------------
 * Why this exists when social/README.md says "screenshot is fine here":
 *
 * It still is, for the Facebook and Instagram tiles. Those are made once, looked
 * at, and uploaded by a person who can see whether they came out right.
 *
 * The OG images are different in kind. They are a build output that ships inside
 * lmslocal-web/public/ and is fetched by crawlers, not people, so nobody ever
 * looks at the file again after the day it was made. Two failures that a human
 * would catch on a tile go unnoticed here for months:
 *
 *  1. A hand capture on a HiDPI screen comes out at DPR 2 — 2400x1260 instead of
 *     1200x630. Nothing rejects it; every platform just re-compresses it.
 *  2. Opening the page as file:// silently loses two of the three brand fonts
 *     and Chrome substitutes Arial, exactly as it does for the leaflets. A
 *     preview set in the wrong face is the first thing anyone sees of the brand.
 *
 * So: serve over http (fonts load), force DPR 1, and clip the capture to exactly
 * the tile. The `?bare` mode strips social.css's grey desk and instruction line,
 * which are there for the human workflow and would otherwise land in the file —
 * see _shared/bare.js.
 *
 * Chrome is driven over the DevTools protocol rather than with --screenshot and
 * --window-size, which is the obvious way and is wrong: in new headless the
 * window size includes the frame, so the first version of this script produced a
 * 1200x630 file with the bottom 100px of the tile missing and a white band in
 * its place. It looked like a rendering bug rather than a measurement one. A
 * CDP clip is stated in CSS pixels and cannot drift.
 *
 * The other thing CDP buys is waiting for document.fonts.ready before capturing,
 * so a slow webfont cannot produce a silent Arial fallback the way it can in the
 * leaflet pipeline.
 *
 * Output goes straight into lmslocal-web/public/ rather than out/, because
 * unlike a leaflet the PNG is not the deliverable — the deployed site is. A file
 * sitting in out/ that someone has to remember to copy is a file that goes
 * stale the first time the copy changes.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = 8118; // make-pdf.js uses 8117; nothing else in this repo binds a port.
const DEBUG_PORT = 9333; // Chrome's DevTools endpoint, this process only.

/*
 * The smallest possible DevTools client: send a command, get a promise back.
 * WebSocket is global from Node 22, so this needs no dependency — which matters,
 * because the whole folder deliberately has no package.json.
 */
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let id = 0;

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      const waiting = pending.get(msg.id);
      if (!waiting) return;
      pending.delete(msg.id);
      msg.error ? waiting.reject(new Error(msg.error.message)) : waiting.resolve(msg.result);
    });
    ws.addEventListener('error', () => reject(new Error(`Could not open ${url}`)));
    ws.addEventListener('open', () =>
      resolve({
        send: (method, params) =>
          new Promise((res, rej) => {
            const next = ++id;
            pending.set(next, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id: next, method, params: params || {} }));
          }),
        close: () => ws.close(),
      })
    );
  });
}

/*
 * Chrome takes a moment to open its debugging port; there is no signal for it
 * other than the endpoint starting to answer.
 *
 * This returns the socket for the blank TAB, not the one /json/version hands
 * out. That one is the browser itself, and it does not carry Emulation or Page —
 * the failure is "'Emulation.setDeviceMetricsOverride' wasn't found", which
 * reads like a Chrome version problem and is not.
 */
async function waitForPageSocket() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const page = (await res.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Port not up yet.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome never opened a debuggable tab.');
}

/*
 * The tiles this script knows how to build.
 *
 * Size is declared here as well as in the page's own CSS because the window has
 * to be sized before the page loads — there is no way to measure .tile first.
 * The check after the render catches the two drifting apart.
 */
const TILES = {
  'og-join': {
    width: 1200,
    height: 630,
    dest: '../lmslocal-web/public/og-join.png',
    note: 'link preview for /join/[code]',
  },
  'og-default': {
    width: 1200,
    height: 630,
    dest: '../lmslocal-web/public/og-image.png',
    note: 'site-wide link preview',
  },
};

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

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

/* --- main ------------------------------------------------------------------ */

const name = process.argv.slice(2).find((a) => !a.startsWith('--'));

if (!name || !TILES[name]) {
  console.error('Usage: node make-png.js <tile>');
  console.error('Tiles available:');
  for (const [key, t] of Object.entries(TILES)) {
    console.error(`  ${key.padEnd(12)} ${t.width}x${t.height}  ->  ${t.dest}  (${t.note})`);
  }
  process.exit(1);
}

const tile = TILES[name];
const source = path.join(ROOT, 'social', name + '.html');
if (!fs.existsSync(source)) {
  console.error(`No such tile page: ${source}`);
  process.exit(1);
}

const chrome = findChrome();
if (!chrome) {
  console.error('Could not find Chrome. Install it, or edit findChrome() in this file.');
  process.exit(1);
}

const dest = path.resolve(ROOT, tile.dest);
if (!fs.existsSync(path.dirname(dest))) {
  console.error(`Destination folder does not exist: ${path.dirname(dest)}`);
  process.exit(1);
}

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
  console.log(`${name} — ${tile.note}`);
  console.log('  rendering ...');

  const browser = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      // Its own throwaway profile. Without this, Chrome hands the job to the
      // copy you already have open and never exits.
      `--user-data-dir=${profileDir}`,
      '--disable-extensions',
      '--hide-scrollbars',
      `--remote-debugging-port=${DEBUG_PORT}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  // Never hang: a wedged Chrome should fail loudly rather than sit there.
  const guard = setTimeout(() => {
    console.error('Timed out waiting for Chrome.');
    browser.kill();
    process.exit(1);
  }, 120000);

  try {
    const page = await connect(await waitForPageSocket());

    // The clip below is in CSS pixels and the scale is 1, so this is what makes
    // the output file the size it claims to be.
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: tile.width,
      height: tile.height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await page.send('Page.enable');
    await page.send('Page.navigate', {
      url: `http://localhost:${PORT}/social/${name}.html?bare`,
    });

    // Webfonts are the whole reason for the local server, so wait for them
    // rather than for the load event, which fires first.
    await page.send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => true)',
      awaitPromise: true,
    });

    const shot = await page.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: tile.width, height: tile.height, scale: 1 },
    });

    fs.writeFileSync(dest, Buffer.from(shot.data, 'base64'));
    page.close();
  } catch (error) {
    console.error('Chrome failed to produce a PNG.', error.message);
    browser.kill();
    server.close();
    process.exit(1);
  }

  clearTimeout(guard);
  browser.kill();
  server.close();
  report();
});

/*
 * Read the dimensions back out of the finished file rather than trusting that
 * the flags did what they were meant to. Width and height are big-endian at a
 * fixed offset in a PNG's IHDR chunk, which is always the first one.
 */
function report() {
  const buf = fs.readFileSync(dest);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const ok = width === tile.width && height === tile.height;

  console.log('');
  console.log('  ' + dest);
  console.log(
    `  ${(buf.length / 1024).toFixed(0)} KB · ${width} x ${height}` +
      (ok ? ' (correct)' : ` — SHOULD BE ${tile.width} x ${tile.height}`)
  );
  console.log('');

  if (!ok) {
    console.error('  The window size and the .tile size in the page have drifted apart.');
    process.exit(1);
  }

  console.log('  Commit it — it ships with the site, it is not scratch.');
  console.log('  Chat apps cache previews hard: test with a URL they have not seen.');
}
