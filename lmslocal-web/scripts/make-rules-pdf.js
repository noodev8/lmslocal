/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Build public/last-man-standing-rules.pdf — the free printable rules sheet.
 *
 *   node scripts/make-rules-pdf.js
 *
 * WHY THIS IS NOT IN lmslocal-marketing. That project owns artwork that ends as a PDF or PNG
 * instead of a page — leaflets a print shop runs. This is a site asset: a file the website serves
 * to anybody who asks for it, which is why it has to live under lmslocal-web/public to be
 * deployed at all. It needs none of the print pipeline either — no bleed, and no Ghostscript pass
 * to outline the fonts, because nobody is sending it to a printer but the person who downloaded
 * it. It sits beside scripts/make-lms-template.py, which makes the other downloadable.
 *
 * WHY IT SERVES OVER HTTP RATHER THAN OPENING THE FILE. Straight from the hard-won comment in
 * lmslocal-marketing/make-pdf.js: a file:// page silently fails to load webfonts and Chrome
 * substitutes Arial without complaint. The sheet still looks fine, so it passes the eye and ships
 * wrong. A throwaway local server costs ten lines and removes the failure mode.
 *
 * DO NOT ADD --virtual-time-budget. It looks like the correct way to wait for the fonts and it
 * makes new-headless Chrome hang forever instead of exiting. Chrome already waits for them.
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 47812;
const SRC = path.join(__dirname, 'rules-pdf');
const OUT = path.join(__dirname, '..', 'public', 'last-man-standing-rules.pdf');

function findChrome() {
  return [
    path.join(process.env['ProgramFiles'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['LOCALAPPDATA'] || '', 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome'
  ].find((p) => p && fs.existsSync(p));
}

function run(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    // Async, not spawnSync: the server below lives in this same process, so blocking the event
    // loop means Chrome's request is never answered and it waits for a page that cannot arrive.
    const child = spawn(cmd, args, { stdio: 'ignore' });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ error: 'timed out' });
    }, timeoutMs);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve({});
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ error: error.message });
    });
  });
}

const chrome = findChrome();
if (!chrome) {
  console.error('Chrome not found. Install Google Chrome, or add its path to findChrome().');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const file = path.join(SRC, req.url === '/' ? 'rules.html' : path.basename(req.url));
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(file));
});

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-rules-chrome-'));

server.listen(PORT, async () => {
  console.log('rendering the rules sheet ...');
  const result = await run(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      // Its own throwaway profile, or Chrome hands the job to the copy you already have open and
      // this process never exits.
      `--user-data-dir=${profileDir}`,
      '--disable-extensions',
      '--hide-scrollbars',
      '--no-pdf-header-footer', // Otherwise Chrome stamps the URL and today's date on the sheet.
      '--print-to-pdf-no-header',
      `--print-to-pdf=${OUT}`,
      `http://localhost:${PORT}/`
    ],
    120000
  );

  server.close();
  fs.rmSync(profileDir, { recursive: true, force: true });

  if (result.error || !fs.existsSync(OUT)) {
    console.error('failed:', result.error || 'no PDF produced');
    process.exit(1);
  }
  console.log(`wrote ${OUT} (${fs.statSync(OUT).size} bytes)`);
});
