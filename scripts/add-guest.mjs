#!/usr/bin/env node
/**
 * Usage: node scripts/add-guest.mjs --user acme-review --expires 2026-12-05 [--list '<current GUEST_USERS JSON>']
 * Generates a password for a time-limited guest login and prints the updated
 * GUEST_USERS value to paste into Vercel (Settings → Environment Variables),
 * then redeploy. Access ends at 23:59 UK time on the expiry date.
 * With --list, the new guest is merged into the existing list and expired
 * guests are dropped. Only a hash of the password is stored — send the
 * password itself to the visitor; it can't be recovered later.
 */
import { createHash, randomInt } from 'crypto';

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const user = getArg('user')?.trim().toLowerCase();
const expires = getArg('expires')?.trim();
const listRaw = getArg('list');

if (!user || !expires) {
  console.error('Usage: node scripts/add-guest.mjs --user acme-review --expires 2026-12-05 [--list \'<current GUEST_USERS JSON>\']');
  process.exit(1);
}

// Keep in sync with GUEST_NAME in middleware.ts.
if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(user)) {
  console.error('Username must be 2–40 characters: lowercase letters, numbers and hyphens, starting with a letter or number.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const valid = /^\d{4}-\d{2}-\d{2}$/.test(expires) && new Date(`${expires}T00:00:00Z`).toISOString().slice(0, 10) === expires;
if (!valid) {
  console.error('--expires must be a real date in YYYY-MM-DD format, e.g. 2026-12-05.');
  process.exit(1);
}
if (expires < today) {
  console.error(`--expires ${expires} is in the past.`);
  process.exit(1);
}

let list = {};
if (listRaw) {
  try {
    list = JSON.parse(listRaw);
  } catch {
    console.error('--list is not valid JSON. Copy the GUEST_USERS value from Vercel exactly.');
    process.exit(1);
  }
}

// Unambiguous characters (no 0/o, 1/l/i) in 4 groups of 5 — about 100 bits.
const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const password = Array.from({ length: 4 }, () =>
  Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('')
).join('-');
const hash = createHash('sha256').update(`${user}:${password}`).digest('hex');

const dropped = Object.entries(list).filter(([, v]) => typeof v?.expires === 'string' && v.expires < today).map(([k]) => k);
for (const name of dropped) delete list[name];
const replacing = user in list;
list[user] = { expires, hash };

console.log(`\nGuest login ${replacing ? 'updated' : 'created'}:`);
console.log(`  Username: ${user}`);
console.log(`  Password: ${password}`);
console.log(`  Access until: 23:59 UK time on ${expires}`);
if (dropped.length) console.log(`  Removed expired guests: ${dropped.join(', ')}`);
console.log('\nSet GUEST_USERS in Vercel to this value, then redeploy:\n');
console.log(JSON.stringify(list));
console.log('');
