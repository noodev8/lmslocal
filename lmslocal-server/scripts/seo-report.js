/*
=======================================================================================================================================
Script: scripts/seo-report.js   (Google Search Console for lmslocal.co.uk — READ ONLY)
=======================================================================================================================================
Purpose: How lmslocal.co.uk is doing in Google search: the weekly trend, and which searches and pages bring impressions and clicks.
         Replaces scripts/seo/gsc_client.py, the Python client the title comment in lmslocal-web/src/app/layout.tsx used to cite,
         which lived outside this repo and was removed.

Auth: there is no LMSLocal service account. This borrows the token helper and Search Console key of another local project, whose
      service account has access to the sc-domain:lmslocal.co.uk property. GSC_AUTH_DIR (lmslocal-server/.env, local only) points at
      that project's server folder; its utils/googleAuth.js and .env supply the key. The scope is webmasters.readonly, so nothing
      here can change anything in Search Console. If LMSLocal gets its own key, swap getToken() and drop GSC_AUTH_DIR.

Dates: Search Console is complete only up to ~3 days ago, so every window ends there; the last days would otherwise read as a fall.

Usage (from lmslocal-server/):
    node scripts/seo-report.js                         weekly clicks / impressions / CTR / position, last 26 weeks
    node scripts/seo-report.js queries [days]          top searches, last N days (default 28)
    node scripts/seo-report.js pages [days]            top pages, last N days (default 28)
    node scripts/seo-report.js compare YYYY-MM-DD      top searches: the 28 days before that date vs the last 28 days
    --top N                                            rows for queries / pages / compare (default 25)
=======================================================================================================================================
*/

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SITE = 'sc-domain:lmslocal.co.uk';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const LAG_DAYS = 3;

const authDir = process.env.GSC_AUTH_DIR;
if (!authDir) {
  console.error('GSC_AUTH_DIR is not set in lmslocal-server/.env (see the header of this script).');
  process.exit(1);
}
// The borrowed helper reads its key from its own project's .env, so load that too. dotenv never overwrites a variable already set,
// so nothing of ours is replaced.
require(path.join(authDir, 'node_modules', 'dotenv')).config({ path: path.join(authDir, '.env') });
const { getAccessToken } = require(path.join(authDir, 'utils', 'googleAuth'));

// Local calendar date, not toISOString(), which shifts a day across midnight in BST.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const lastComplete = () => addDays(new Date(), -LAG_DAYS);

async function gsc(body) {
  const token = await getAccessToken(SCOPE);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rowLimit: 25000, ...body }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Search Console ${resp.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text).rows || [];
}

const pct = (c, i) => (i ? (100 * c / i).toFixed(1) : '0.0') + '%';
const row = (impr, clicks, ctr, pos, label) =>
  `${String(impr).padStart(6)} ${String(clicks).padStart(5)} ${ctr.padStart(6)} ${pos.padStart(5)}  ${label}`;
const HEAD = row('impr', 'click', 'ctr', 'pos', '');

async function weekly() {
  const end = lastComplete();
  const rows = await gsc({ startDate: ymd(addDays(end, -26 * 7)), endDate: ymd(end), dimensions: ['date'] });
  const weeks = new Map();
  for (const r of rows) {
    const d = new Date(r.keys[0] + 'T12:00:00');
    const monday = ymd(addDays(d, -((d.getDay() + 6) % 7)));
    const w = weeks.get(monday) || { c: 0, i: 0, p: 0, days: 0 };
    w.c += r.clicks; w.i += r.impressions; w.p += r.position * r.impressions; w.days += 1;
    weeks.set(monday, w);
  }
  console.log(`\n${SITE} — weekly, to ${ymd(end)} (position is impression-weighted; a week with < 7 days is partial)\n`);
  console.log('week of     ' + HEAD);
  for (const [k, w] of [...weeks].sort()) {
    console.log(`${k}  ${row(w.i, w.c, pct(w.c, w.i), w.i ? (w.p / w.i).toFixed(1) : '-', w.days < 7 ? `(${w.days} days)` : '')}`);
  }
}

async function top(dimension, days, n) {
  const end = lastComplete();
  const start = addDays(end, -(days - 1));
  const rows = await gsc({ startDate: ymd(start), endDate: ymd(end), dimensions: [dimension] });
  const tot = rows.reduce((a, r) => ({ c: a.c + r.clicks, i: a.i + r.impressions }), { c: 0, i: 0 });
  console.log(`\n${SITE} — top ${dimension === 'query' ? 'searches' : 'pages'}, ${ymd(start)} to ${ymd(end)}`);
  console.log(`(rows listed total ${tot.i} impressions, ${tot.c} clicks; Google hides rare queries, so these undercount the site total)\n`);
  console.log(HEAD);
  for (const r of rows.sort((a, b) => b.impressions - a.impressions).slice(0, n)) {
    console.log(row(r.impressions, r.clicks, (100 * r.ctr).toFixed(1) + '%', r.position.toFixed(1), r.keys[0].replace('https://lmslocal.co.uk', '') || '/'));
  }
}

async function compare(changeDate, n) {
  const change = new Date(changeDate + 'T12:00:00');
  const end = lastComplete();
  const windows = [
    { label: 'before', start: addDays(change, -28), end: addDays(change, -1) },
    { label: 'now', start: addDays(end, -27), end },
  ];
  const data = [];
  for (const w of windows) {
    const totals = (await gsc({ startDate: ymd(w.start), endDate: ymd(w.end) }))[0] || { clicks: 0, impressions: 0, position: 0 };
    const byQuery = new Map((await gsc({ startDate: ymd(w.start), endDate: ymd(w.end), dimensions: ['query'] })).map((r) => [r.keys[0], r]));
    data.push({ ...w, totals, byQuery });
  }
  const [b, a] = data;
  console.log(`\n${SITE} — before ${changeDate} (${ymd(b.start)}..${ymd(b.end)}) vs now (${ymd(a.start)}..${ymd(a.end)})\n`);
  for (const w of data) {
    const t = w.totals;
    console.log(`${w.label.padEnd(7)} impressions ${t.impressions}, clicks ${t.clicks}, ctr ${pct(t.clicks, t.impressions)}, position ${(t.position || 0).toFixed(1)}`);
  }
  console.log(`\n${'search'.padEnd(42)} ${'impr b→now'.padStart(13)} ${'clicks'.padStart(9)} ${'ctr'.padStart(13)} ${'pos'.padStart(11)}`);
  const keys = new Set([...b.byQuery.keys(), ...a.byQuery.keys()]);
  const ranked = [...keys].sort((x, y) =>
    Math.max(b.byQuery.get(y)?.impressions || 0, a.byQuery.get(y)?.impressions || 0) -
    Math.max(b.byQuery.get(x)?.impressions || 0, a.byQuery.get(x)?.impressions || 0)).slice(0, n);
  const cell = (r, f) => (r ? f(r) : '-');
  for (const k of ranked) {
    const rb = b.byQuery.get(k); const ra = a.byQuery.get(k);
    console.log(`${k.slice(0, 42).padEnd(42)} ${(cell(rb, (r) => r.impressions) + '→' + cell(ra, (r) => r.impressions)).padStart(13)} ` +
      `${(cell(rb, (r) => r.clicks) + '→' + cell(ra, (r) => r.clicks)).padStart(9)} ` +
      `${(cell(rb, (r) => (100 * r.ctr).toFixed(1)) + '→' + cell(ra, (r) => (100 * r.ctr).toFixed(1))).padStart(13)} ` +
      `${(cell(rb, (r) => r.position.toFixed(1)) + '→' + cell(ra, (r) => r.position.toFixed(1))).padStart(11)}`);
  }
}

(async () => {
  const args = process.argv.slice(2);
  const topIdx = args.indexOf('--top');
  const n = topIdx >= 0 ? Number(args.splice(topIdx, 2)[1]) || 25 : 25;
  const [mode = 'weekly', arg] = args;
  if (mode === 'weekly') await weekly();
  else if (mode === 'queries') await top('query', Number(arg) || 28, n);
  else if (mode === 'pages') await top('page', Number(arg) || 28, n);
  else if (mode === 'compare' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '')) await compare(arg, n);
  else { console.error('Usage: see the header of scripts/seo-report.js'); process.exit(1); }
})().catch((e) => { console.error(e.message); process.exit(1); });
