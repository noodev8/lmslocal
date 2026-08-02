#!/usr/bin/env node
/*
=======================================================================================================================================
db/query.js — ad-hoc READ-ONLY query against the LMSLocal database
=======================================================================================================================================
The front door for "just look something up" — exploration, schema checks, sanity-checking a
number before acting on it. Application code keeps using ../database.js; this is for
interactive use from a terminal or by Claude.

    node db/query.js "SELECT count(*) FROM competition"
    node db/query.js --file report.sql
    node db/query.js --csv "SELECT id, name FROM competition" > out.csv
    echo "SELECT 1" | node db/query.js

Every query runs inside a READ ONLY transaction, so an accidental UPDATE/DELETE/DROP fails at
the database rather than doing damage. That is a guard against accidents, not a security
boundary — the credentials in .env can still write, so anything that genuinely needs to write
goes through db/write.js.

See db/README.md for the gotchas that will otherwise cost you an hour.
=======================================================================================================================================
*/

const fs = require('fs');
const path = require('path');

// .env lives one level up, next to server.js. Anchor on __dirname — this script is often run
// from the repo root or another directory, so a relative path resolves against the wrong home.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Client } = require('pg');

const DEFAULT_MAX_ROWS = 200;

/**
 * Fixed-width table. Readable in a terminal and stable enough to diff.
 */
function renderTable(columns, rows) {
  const cells = rows.map(row => row.map(v => (v === null || v === undefined ? '' : String(v))));
  const widths = columns.map(c => c.length);
  for (const row of cells) {
    row.forEach((value, i) => {
      widths[i] = Math.max(widths[i], value.length);
    });
  }

  const out = [columns.map((c, i) => c.padEnd(widths[i])).join(' | ').trimEnd()];
  out.push(widths.map(w => '-'.repeat(w)).join('-+-'));
  for (const row of cells) {
    out.push(row.map((v, i) => v.padEnd(widths[i])).join(' | ').trimEnd());
  }
  return out.join('\n');
}

/**
 * Minimal CSV escaping — quote anything containing a comma, quote or newline.
 */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Read SQL from --file, positional args, or stdin (in that order).
 */
function readSql(args) {
  if (args.file) {
    return fs.readFileSync(args.file, 'utf8');
  }
  if (args.sql.length > 0) {
    return args.sql.join(' ');
  }
  if (!process.stdin.isTTY) {
    return fs.readFileSync(0, 'utf8');
  }
  return '';
}

function parseArgs(argv) {
  const args = { sql: [], file: null, csv: false, maxRows: DEFAULT_MAX_ROWS };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-f' || a === '--file') {
      args.file = argv[++i];
    } else if (a.startsWith('--file=')) {
      args.file = a.slice('--file='.length);
    } else if (a === '--csv') {
      args.csv = true;
    } else if (a === '--max-rows') {
      args.maxRows = parseInt(argv[++i], 10);
    } else if (a.startsWith('--max-rows=')) {
      args.maxRows = parseInt(a.slice('--max-rows='.length), 10);
    } else if (a === '-h' || a === '--help') {
      args.help = true;
    } else {
      args.sql.push(a);
    }
  }

  if (Number.isNaN(args.maxRows)) {
    args.maxRows = DEFAULT_MAX_ROWS;
  }
  return args;
}

const USAGE = `Run a read-only SQL query against the LMSLocal database.

  node db/query.js "SELECT ..."       SQL as an argument (quote it)
  node db/query.js -f, --file FILE    read SQL from a file instead
  node db/query.js --csv "..."        emit CSV instead of a table
  node db/query.js --max-rows N       stop printing after N rows (default ${DEFAULT_MAX_ROWS}; 0 for no limit)`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const sql = readSql(args).trim();
  if (!sql) {
    console.error('No SQL given — pass it as an argument, with --file, or on stdin.\n');
    console.error(USAGE);
    return 2;
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    await client.connect();
  } catch (error) {
    console.error(`Could not connect: ${error.message}`);
    console.error('Check DB_* values in lmslocal-server/.env.');
    return 1;
  }

  try {
    // Belt and braces: the session refuses writes, and so does the transaction. Either alone
    // would do; both means a stray commit path cannot slip through.
    await client.query('SET default_transaction_read_only = on');
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');

    const result = await client.query(sql);

    // Multiple statements in one string come back as an array of results — report on the last
    // one that actually returned rows, which is what an interactive user is looking for.
    const last = Array.isArray(result) ? result[result.length - 1] : result;

    if (!last.fields || last.fields.length === 0) {
      console.log(`OK — no rows returned (${last.command || 'done'}).`);
      return 0;
    }

    const columns = last.fields.map(f => f.name);
    const rows = last.rows.map(r => columns.map(c => r[c]));
    const shown = args.maxRows === 0 ? rows : rows.slice(0, args.maxRows);

    if (args.csv) {
      const lines = [columns.map(csvCell).join(',')];
      for (const row of shown) lines.push(row.map(csvCell).join(','));
      process.stdout.write(lines.join('\n') + '\n');
    } else {
      console.log(renderTable(columns, shown));
      console.log(`\n(${rows.length} row${rows.length === 1 ? '' : 's'})`);
    }

    if (shown.length < rows.length) {
      console.error(`-- showing first ${shown.length} of ${rows.length}; raise --max-rows or add a LIMIT`);
    }
    return 0;
  } catch (error) {
    // Includes the read-only rejection, which is the point: a write fails here rather than
    // succeeding quietly.
    console.error(`Query failed: ${error.message}`);
    return 1;
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* connection may already be gone */ }
    await client.end();
  }
}

main().then(code => process.exit(code));
