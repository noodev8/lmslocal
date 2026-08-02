#!/usr/bin/env node
/*
=======================================================================================================================================
db/write.js — ad-hoc WRITE against the LMSLocal database
=======================================================================================================================================
Writing is allowed — this is not a locked door. The script exists so writes happen the same way
every time: in one transaction, with the affected row count reported, and with a dry run
available when you want to see the damage first.

    node db/write.js "UPDATE competition SET status='ACTIVE' WHERE id=42"
    node db/write.js --dry-run "DELETE FROM pick WHERE round_id=101"
    node db/write.js --file migration.sql

Everything in one invocation runs in a single transaction and commits together, or rolls back
together if any statement fails. Reads still belong in db/query.js.

The one guard: an UPDATE or DELETE with no WHERE clause is refused unless you pass --all-rows.
That is the mistake worth catching; nothing else is in the way.

See db/README.md.
=======================================================================================================================================
*/

const fs = require('fs');
const path = require('path');

// .env lives one level up, next to server.js — anchor on __dirname, not the cwd.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Client } = require('pg');

// Statements that change data and are near-always meant to be scoped.
const UNSCOPED_RISK = /^\s*(update|delete)\s/i;

/**
 * Split on semicolons that aren't inside quotes, dollar-quoted blocks or comments.
 * Comments are kept in the statement text (so the echoed label still reads sensibly) —
 * they are only skipped over so a semicolon inside one cannot split the statement.
 */
function splitStatements(sql) {
  const statements = [];
  let buf = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const two = sql.slice(i, i + 2);

    // -- line comment, runs to end of line
    if (two === '--') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // /* block comment */ (Postgres nests these, but one level covers real usage)
    if (two === '/*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // $tag$ ... $tag$ dollar quoting, as used by function bodies
    if (ch === '$') {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (tag) {
        const marker = tag[0];
        const end = sql.indexOf(marker, i + marker.length);
        const stop = end === -1 ? sql.length : end + marker.length;
        buf += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }

    // '...' and "..." — a doubled quote inside is an escaped quote, and falls out
    // naturally: the closing quote ends the literal and the next one reopens it.
    if (ch === "'" || ch === '"') {
      const end = sql.indexOf(ch, i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (ch === ';') {
      statements.push(buf);
      buf = '';
      i++;
      continue;
    }

    buf += ch;
    i++;
  }

  statements.push(buf);
  return statements.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Strip comments and the contents of string literals, leaving the SQL keywords.
 *
 * The guard below has to read real keywords, not text that merely looks like them. Without
 * this, `-- housekeeping\nUPDATE competition SET name=name` does not start with "UPDATE" as
 * far as a regex is concerned, and an unscoped UPDATE walks straight past the guard; equally,
 * the word "where" sitting in a comment or a quoted string must not count as a WHERE clause.
 *
 * Inspection only — the statement actually executed is always the original text.
 */
function sqlSkeleton(stmt) {
  let out = '';
  let i = 0;

  while (i < stmt.length) {
    const ch = stmt[i];
    const two = stmt.slice(i, i + 2);

    if (two === '--') {
      const end = stmt.indexOf('\n', i);
      i = end === -1 ? stmt.length : end;
      out += ' ';
      continue;
    }
    if (two === '/*') {
      const end = stmt.indexOf('*/', i + 2);
      i = end === -1 ? stmt.length : end + 2;
      out += ' ';
      continue;
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(stmt.slice(i));
      if (tag) {
        const marker = tag[0];
        const end = stmt.indexOf(marker, i + marker.length);
        i = end === -1 ? stmt.length : end + marker.length;
        out += " '' ";
        continue;
      }
    }
    if (ch === "'" || ch === '"') {
      const end = stmt.indexOf(ch, i + 1);
      i = end === -1 ? stmt.length : end + 1;
      out += ch === '"' ? ' ident ' : " '' ";
      continue;
    }

    out += ch;
    i++;
  }

  return out.trim();
}

/**
 * Refuse an UPDATE/DELETE with no WHERE unless explicitly allowed.
 */
function checkUnscoped(statements, allowAllRows) {
  if (allowAllRows) return null;
  for (const stmt of statements) {
    const bare = sqlSkeleton(stmt);
    if (UNSCOPED_RISK.test(bare) && !/\bwhere\b/i.test(bare)) {
      const verb = bare.split(/\s+/)[0].toUpperCase();
      return `${verb} with no WHERE clause would affect every row:\n  ${bare.slice(0, 120)}\n` +
             'Add a WHERE, or pass --all-rows if that really is the intent.';
    }
  }
  return null;
}

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
  const args = { sql: [], file: null, dryRun: false, allRows: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-f' || a === '--file') {
      args.file = argv[++i];
    } else if (a.startsWith('--file=')) {
      args.file = a.slice('--file='.length);
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--all-rows') {
      args.allRows = true;
    } else if (a === '-h' || a === '--help') {
      args.help = true;
    } else {
      args.sql.push(a);
    }
  }
  return args;
}

const USAGE = `Run write SQL against the LMSLocal database, in one transaction.

  node db/write.js "UPDATE ..."       SQL as an argument (quote it)
  node db/write.js -f, --file FILE    read SQL from a file instead
  node db/write.js --dry-run "..."    execute, report row counts, then roll back
  node db/write.js --all-rows "..."   permit an UPDATE/DELETE with no WHERE clause`;

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

  const statements = splitStatements(sql);
  const problem = checkUnscoped(statements, args.allRows);
  if (problem) {
    console.error(`Refused: ${problem}`);
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

  let total = 0;
  try {
    await client.query('BEGIN'); // one transaction for the whole invocation

    for (const stmt of statements) {
      const result = await client.query(stmt);
      const affected = result.rowCount > 0 ? result.rowCount : 0;
      total += affected;
      // Label from the comment-stripped form, so a leading comment doesn't hide the verb.
      const label = sqlSkeleton(stmt).split(/\s+/).slice(0, 6).join(' ');
      const status = (result.command || 'OK').padEnd(20);
      console.log(`${status} ${String(affected).padStart(7)} row(s)  <- ${label}`);
    }

    if (args.dryRun) {
      await client.query('ROLLBACK');
      console.log(`\nDRY RUN — rolled back. ${total} row(s) would have changed.`);
    } else {
      await client.query('COMMIT');
      console.log(`\nCommitted. ${total} row(s) changed.`);
    }
    return 0;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* connection may already be gone */ }
    console.error(`\nFailed, rolled back — nothing was changed.\n${error.message}`);
    return 1;
  } finally {
    await client.end();
  }
}

main().then(code => process.exit(code));
