/*
=======================================================================================================================================
Compare two capture runs
=======================================================================================================================================
Usage: node tests/compare.js <before-label> <after-label>

Exits non-zero if any file differs, so it can gate a change.
=======================================================================================================================================
*/

const fs = require('fs');
const path = require('path');

const [before, after] = process.argv.slice(2);
if (!before || !after) {
  console.error('usage: node tests/compare.js <before-label> <after-label>');
  process.exit(1);
}

const dirA = path.join(__dirname, 'captures', before);
const dirB = path.join(__dirname, 'captures', after);

for (const dir of [dirA, dirB]) {
  if (!fs.existsSync(dir)) {
    console.error(`missing capture directory: ${dir}`);
    process.exit(1);
  }
}

const files = fs.readdirSync(dirA).filter(f => f.endsWith('.json'));
let differences = 0;
let historyRows = 0;

for (const file of files) {
  const a = fs.readFileSync(path.join(dirA, file), 'utf8');

  if (!fs.existsSync(path.join(dirB, file))) {
    console.log(`MISSING    ${file} - not present in "${after}"`);
    differences++;
    continue;
  }

  const b = fs.readFileSync(path.join(dirB, file), 'utf8');

  if (a === b) {
    console.log(`IDENTICAL  ${file}  (${a.length} bytes)`);
  } else {
    console.log(`DIFFERS    ${file}`);
    differences++;
  }

  // Track how much data the sample carried - two identical empty responses
  // prove nothing, so surface it rather than letting it pass quietly
  try {
    const parsed = JSON.parse(a);
    historyRows += (parsed.competitions || []).reduce((n, c) => n + (c.history || []).length, 0);
  } catch { /* a malformed capture is already a failure above */ }
}

console.log(`\n${files.length} file(s) compared, ${historyRows} history rows in the sample`);

if (historyRows === 0) {
  console.log('WARNING: the sample contains no history rows, so it does not exercise much.');
}

console.log(differences === 0
  ? `PASS - "${before}" and "${after}" are byte-for-byte identical`
  : `FAIL - ${differences} file(s) differ`);

process.exit(differences === 0 ? 0 : 1);
