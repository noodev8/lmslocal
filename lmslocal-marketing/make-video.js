/*
 * Turn video/film.html into an MP4.
 *
 *   node make-video.js
 *
 * The file lands in out/ as promo-landlord.mp4. Add --fast to render every
 * second frame at half rate for a quick look while editing the film; the
 * result is rougher and is not what you post.
 *
 * ---------------------------------------------------------------------------
 * Why a frame at a time rather than a screen recorder:
 *
 *  1. A recorder captures whatever the machine managed to paint. Under load it
 *     drops frames, so the same film comes out different every run and you can
 *     never tell an animation problem from a busy laptop.
 *
 *  2. film.html has no CSS animations and no timers. It exposes seek(t), which
 *     is a pure function of the timestamp, so this script can step time by hand
 *     and take as long as it likes over each frame. Frame 412 is identical on
 *     every run and on every machine.
 *
 *  3. Fonts. Same trap as the leaflets - a file:// page silently falls back to
 *     Arial for two of the three brand faces, so the film is served over http
 *     and the render waits on document.fonts.ready rather than the load event,
 *     which fires first.
 *
 * Chrome is driven over the DevTools protocol for the reason make-png.js gives:
 * new headless ignores --window-size for screenshots, and the clip below is
 * what actually makes the output 1080x1080.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = 8123;
const DEBUG_PORT = 9223;

const SIZE = 1080;
const FPS = 30;

const fast = process.argv.includes('--fast');
const OUT_DIR = path.join(ROOT, 'out');
const FRAME_DIR = path.join(OUT_DIR, 'frames');
const DEST = path.join(OUT_DIR, 'promo-landlord.mp4');

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

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-1500)}`))
    );
  });
}

/* --- main ------------------------------------------------------------------ */

const chrome = findChrome();
if (!chrome) {
  console.error('Could not find Chrome. Install it, or edit findChrome() in this file.');
  process.exit(1);
}

// Frames are scratch and are rebuilt every run, so the directory is emptied
// rather than added to: a shorter film would otherwise keep the tail of a
// longer one and ffmpeg would silently splice them together.
fs.rmSync(FRAME_DIR, { recursive: true, force: true });
fs.mkdirSync(FRAME_DIR, { recursive: true });

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-video-'));

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
  const browser = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      // Its own throwaway profile, or Chrome hands the job to the copy you
      // already have open and never exits.
      `--user-data-dir=${profileDir}`,
      '--disable-extensions',
      '--hide-scrollbars',
      `--remote-debugging-port=${DEBUG_PORT}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const guard = setTimeout(() => {
    console.error('Timed out waiting for Chrome.');
    browser.kill();
    process.exit(1);
  }, 600000);

  let frames = 0;
  const fps = fast ? FPS / 2 : FPS;

  try {
    const page = await connect(await waitForPageSocket());

    await page.send('Emulation.setDeviceMetricsOverride', {
      width: SIZE,
      height: SIZE,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.send('Page.enable');
    await page.send('Page.navigate', { url: `http://localhost:${PORT}/video/film.html` });
    // Fonts AND images. window.READY is the film's own promise over every
    // decoded screenshot; without it the first second of each app scene
    // renders blank because the image has not painted yet.
    await page.send('Runtime.evaluate', {
      expression: 'Promise.all([document.fonts.ready, window.READY]).then(() => true)',
      awaitPromise: true,
    });

    const { result } = await page.send('Runtime.evaluate', { expression: 'window.FILM_DURATION' });
    const duration = result.value;
    const total = Math.round((duration / 1000) * fps);

    console.log(`film.html — ${(duration / 1000).toFixed(1)}s at ${fps}fps, ${total} frames`);

    for (let f = 0; f < total; f++) {
      const t = (f / fps) * 1000;
      // awaitPromise on a rAF means the frame is drawn before it is captured.
      // Without it Chrome will happily screenshot the previous frame's paint.
      await page.send('Runtime.evaluate', {
        expression: `seek(${t}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`,
        awaitPromise: true,
      });
      const shot = await page.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: SIZE, height: SIZE, scale: 1 },
      });
      fs.writeFileSync(
        path.join(FRAME_DIR, String(f).padStart(5, '0') + '.png'),
        Buffer.from(shot.data, 'base64')
      );
      frames++;
      if (f % 30 === 0) process.stdout.write(`  ${f}/${total}\r`);
    }
    page.close();
  } catch (error) {
    console.error('Chrome failed to render the frames.', error.message);
    browser.kill();
    server.close();
    process.exit(1);
  }

  clearTimeout(guard);
  browser.kill();
  server.close();

  console.log(`  ${frames} frames rendered, encoding ...`);

  try {
    await run('ffmpeg', [
      '-y',
      '-framerate', String(fps),
      '-i', path.join(FRAME_DIR, '%05d.png'),
      '-c:v', 'libx264',
      // yuv420p rather than the default yuv444p: Facebook and every phone
      // player accept it, and several will not decode 444 at all.
      '-pix_fmt', 'yuv420p',
      '-crf', '18',
      '-preset', 'slow',
      // faststart puts the index at the front so the video begins playing
      // before the whole file has arrived, which is what a feed needs.
      '-movflags', '+faststart',
      DEST,
    ]);
  } catch (error) {
    console.error('ffmpeg failed.', error.message);
    process.exit(1);
  }

  // --publish also writes the copy the website serves. Same reasoning as
  // make-png.js and the OG images: for the site the deployed file is the
  // deliverable, and an export sitting in out/ waiting to be copied by hand
  // goes stale the first time the film changes and the copy does not.
  if (process.argv.includes('--publish')) {
    const pub = path.resolve(ROOT, '../lmslocal-web/public');
    if (!fs.existsSync(pub)) {
      console.error(`No such folder: ${pub}`);
      process.exit(1);
    }
    /*
     * The web copy is encoded separately rather than copied, at a much higher
     * crf. The master in out/ stays at crf 18 because Facebook re-encodes
     * whatever it is given and you want its input clean; the site serves the
     * file to a browser as-is and wants it small.
     *
     * crf 28 is a quarter the size of crf 18 here - 4012 KB down to ~1000 KB -
     * and the two are indistinguishable at 1:1 on a moving frame of the
     * densest small text in the film. That is not a general claim about crf 28:
     * this film is flat colour, sharp type and almost no motion, which x264
     * handles far better than the live action those defaults are meant for.
     * Re-check by eye if the film ever gains photography.
     */
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-framerate', String(fps),
      '-i', path.join(FRAME_DIR, '%05d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '28',
      '-preset', 'slow',
      '-movflags', '+faststart',
      path.join(pub, 'promo.mp4'),
    ]);

    /*
     * The poster is a real app screen - the pick list with a team chosen - and
     * not the title card it used to be. The film sits in the landing page hero
     * now, so its still state IS the hero's main image, and the point of moving
     * it there was that the hero was previously showing a drawn survival sheet
     * rather than the product. A title card would have put a second headline
     * beside the h1 and shown the product no better than the illustration did.
     *
     * Not frame 0 either: frame 0 is the opening veil, so a still of it is a
     * blank rectangle.
     */
    const POSTER_AT = 32;
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', path.join(FRAME_DIR, String(Math.round(fps * POSTER_AT)).padStart(5, '0') + '.png'),
      /*
       * The caption band is cropped off the bottom and replaced with plain
       * stock. The browser draws its control bar across the bottom of the
       * element, which landed exactly on the band and cut the caption in half.
       * Leaving stock there gives the controls somewhere quiet to sit, and the
       * poster is a clean product screen rather than a frame with half a
       * sentence on it. Same square size, so nothing shifts when it plays.
       */
      '-vf', 'crop=1080:880:0:0,pad=1080:1080:0:0:color=0xDDE1D6',
      '-q:v', '3',
      path.join(pub, 'promo-poster.jpg'),
    ]);
    console.log('  published to lmslocal-web/public/ — commit promo.mp4 and promo-poster.jpg');
  }

  const kb = (fs.statSync(DEST).size / 1024).toFixed(0);
  console.log('');
  console.log(`  ${DEST}`);
  console.log(`  ${kb} KB · ${SIZE}x${SIZE} · ${(frames / fps).toFixed(1)}s`);
  console.log('');
  console.log('  out/ is scratch and git-ignored - re-render rather than archiving this.');
  console.log('  Check the QR in the invite scene still scans - it is ~155px in the frame.');
});
