/*
 * Demonstrates the old auth cache was unbounded and the new one is capped.
 *
 * Both implementations are reproduced exactly as they appear in
 * middleware/auth.js, driven with the same workload: more distinct users than
 * MAX_CACHE_SIZE, all authenticating inside one TTL window (the season-start
 * surge case). Nothing is expired, so the old cleaner has nothing to delete.
 */

const MAX_CACHE_SIZE = 1000;
const CACHE_TTL = 5 * 60 * 1000;
const USERS = 5000;

// ---- OLD -------------------------------------------------------------------
const oldCache = new Map();
let oldScanWork = 0;

const cleanExpiredCache = () => {
  if (oldCache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  const keysToDelete = [];
  for (const [key, value] of oldCache.entries()) {
    oldScanWork++;                                  // count the per-request scan cost
    if (now - value.timestamp > CACHE_TTL) keysToDelete.push(key);
  }
  keysToDelete.forEach(key => oldCache.delete(key));
};

for (let i = 0; i < USERS; i++) {
  oldCache.set(`user_${i}`, { user: { id: i }, timestamp: Date.now() });
  cleanExpiredCache();
}

// ---- NEW -------------------------------------------------------------------
const newCache = new Map();

const evictOldestEntries = () => {
  while (newCache.size > MAX_CACHE_SIZE) {
    newCache.delete(newCache.keys().next().value);
  }
};

for (let i = 0; i < USERS; i++) {
  const key = `user_${i}`;
  newCache.delete(key);
  newCache.set(key, { user: { id: i }, timestamp: Date.now() });
  evictOldestEntries();
}

// ---- RESULTS ---------------------------------------------------------------
console.log(`workload: ${USERS} distinct users inside one ${CACHE_TTL / 60000}-minute TTL window`);
console.log(`cap:      MAX_CACHE_SIZE = ${MAX_CACHE_SIZE}\n`);
console.log(`OLD  entries retained: ${oldCache.size}   (scan comparisons performed: ${oldScanWork.toLocaleString()})`);
console.log(`NEW  entries retained: ${newCache.size}`);

// The new cache must hold exactly the most recent MAX_CACHE_SIZE users
const retained = [...newCache.keys()];
const expectedFirst = `user_${USERS - MAX_CACHE_SIZE}`;
const expectedLast = `user_${USERS - 1}`;

console.log(`\nNEW retains oldest kept = ${retained[0]}, newest = ${retained[retained.length - 1]}`);

const ok =
  newCache.size === MAX_CACHE_SIZE &&
  retained[0] === expectedFirst &&
  retained[retained.length - 1] === expectedLast &&
  oldCache.size === USERS;

console.log(`\n${ok ? 'PASS' : 'FAIL'} - old grows to ${oldCache.size}, new is capped at ${newCache.size} holding the most recent users`);
process.exit(ok ? 0 : 1);
