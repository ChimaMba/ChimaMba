/**
 * Offline self-check:  npm run check
 *
 * Exercises every decision path that can send an email, without touching
 * Gmail or the Claude API. Run it after editing config/policy.json — a
 * mistake in a regex or a category name shows up here instead of in a
 * client's inbox.
 */
import { config, policy } from '../config.js';
import { db, isSuppressed, suppress } from '../db.js';
import { canSendTo, inQuietHours, unsubscribeToken, verifyUnsubscribeToken } from '../compliance.js';
import { decide, shouldIgnore } from '../policy.js';
import { extractBody, parseAddress, trimQuotedReply } from '../gmail.js';
import { ALL_CATEGORIES } from '../types.js';
import type { Classification, ParsedMessage } from '../types.js';

let failures = 0;
let checks = 0;

function ok(label: string, condition: boolean, detail = ''): void {
  checks++;
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `\n      ${detail}` : ''}`);
  }
}

function section(name: string): void {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

const baseClassification = (over: Partial<Classification> = {}): Classification => ({
  category: 'scheduling',
  summary: 'Wants to move Thursday call to Friday.',
  intent: 'Confirm the new time.',
  urgency: 'normal',
  confidence: 0.95,
  risk_flags: [],
  needs_human: false,
  needs_human_reason: '',
  contact_name: 'Ada',
  contact_company: 'Studio Co',
  is_from_a_human: true,
  ...over,
});

const baseMessage = (over: Partial<ParsedMessage> = {}): ParsedMessage => ({
  gmailMessageId: 'm1',
  gmailThreadId: 't1',
  from: 'ada@studio.co',
  fromName: 'Ada Obi',
  to: config.ownerEmail,
  subject: 'Quick question',
  body: 'Can we move Thursday to Friday?',
  snippet: '',
  receivedAt: Date.now(),
  labelIds: ['INBOX', 'UNREAD'],
  ...over,
});

/* ------------------------------------------------------------------ */

section('Configuration');
ok('policy.json parsed', typeof policy.autonomy === 'string');
ok(
  `autonomy is a known value (${policy.autonomy})`,
  ['auto_routine', 'draft_all', 'auto_all'].includes(policy.autonomy),
);
ok(
  'every auto-send category is a real category',
  policy.autoSend.categories.every((c) => (ALL_CATEGORIES as readonly string[]).includes(c)),
  `unknown: ${policy.autoSend.categories.filter((c) => !(ALL_CATEGORIES as readonly string[]).includes(c)).join(', ')}`,
);
ok(
  'no sensitive category is on the auto-send list',
  !policy.autoSend.categories.some((c) =>
    ['pricing', 'scope_change', 'contract_or_legal', 'complaint', 'deadline_commitment', 'refund_or_billing'].includes(
      c,
    ),
  ),
);
ok('owner email looks valid', config.ownerEmail.includes('@'));
ok('APP_SECRET is not the placeholder', config.appSecret !== 'change-me');

for (const group of [
  ['autoSend.blockIfBodyMatches', policy.autoSend.blockIfBodyMatches],
  ['ignore.fromPatterns', policy.ignore.fromPatterns],
  ['ignore.subjectPatterns', policy.ignore.subjectPatterns],
] as const) {
  for (const pattern of group[1]) {
    let valid = true;
    try {
      new RegExp(pattern);
    } catch {
      valid = false;
    }
    ok(`${group[0]}: /${pattern}/ compiles`, valid);
  }
}

/* ------------------------------------------------------------------ */

section('Database');
const tables = (
  db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]
).map((r) => r.name);
for (const t of ['contacts', 'messages', 'drafts', 'campaigns', 'campaign_targets', 'suppression', 'send_log', 'audit']) {
  ok(`table "${t}" exists`, tables.includes(t));
}

/* ------------------------------------------------------------------ */

section('Unsubscribe tokens');
const token = unsubscribeToken('Ada@Studio.CO');
ok('token round-trips and normalises case', verifyUnsubscribeToken(token) === 'ada@studio.co');
ok('tampered token is rejected', verifyUnsubscribeToken(`${token}x`) === null);
ok('garbage token is rejected', verifyUnsubscribeToken('nonsense') === null);

/* ------------------------------------------------------------------ */

section('Send gates');
const probe = `smoke-test-${Date.now()}@example.invalid`;
ok('refuses to email the owner', !canSendTo(config.ownerEmail, 'reply').ok);
ok('refuses a malformed address', !canSendTo('not-an-email', 'reply').ok);
suppress(probe, 'manual');
ok('suppression list is honoured', isSuppressed(probe) && !canSendTo(probe, 'reply').ok);
ok(
  'outreach refuses without POSTAL_ADDRESS',
  config.postalAddress ? true : !canSendTo('someone@example.invalid', 'outreach').ok,
  config.postalAddress ? 'POSTAL_ADDRESS is set, so this gate is inactive' : '',
);
db.prepare('DELETE FROM suppression WHERE email = ?').run(probe);

const qh = policy.autoSend.quietHours;
ok(
  `quiet hours ${qh.start}:00–${qh.end}:00 ${qh.timezone} evaluate without error`,
  typeof inQuietHours() === 'boolean',
);

/* ------------------------------------------------------------------ */

section('Ignore rules');
ok('ignores mail from yourself', shouldIgnore(baseMessage({ from: config.ownerEmail })).ignore);
ok('ignores no-reply senders', shouldIgnore(baseMessage({ from: 'noreply@stripe.com' })).ignore);
ok('ignores auto-replies', shouldIgnore(baseMessage({ subject: 'Automatic reply: away' })).ignore);
ok('ignores promotions label', shouldIgnore(baseMessage({ labelIds: ['CATEGORY_PROMOTIONS'] })).ignore);
ok('lets a normal client email through', !shouldIgnore(baseMessage()).ignore);

/* ------------------------------------------------------------------ */

section('Autonomy decisions');
const safeBody = 'Friday works — I have moved it. See you then.\n\nChima';

ok(
  'routine + high confidence + no flags → auto-send',
  decide(baseClassification(), safeBody).action === 'auto_send',
);
ok(
  'pricing question → held',
  decide(baseClassification({ category: 'pricing' }), safeBody).action === 'hold',
);
ok(
  'complaint → held',
  decide(baseClassification({ category: 'complaint' }), safeBody).action === 'hold',
);
ok(
  'scope change → held',
  decide(baseClassification({ category: 'scope_change' }), safeBody).action === 'hold',
);
ok(
  'any risk flag → held',
  decide(baseClassification({ risk_flags: ['mentions budget'] }), safeBody).action === 'hold',
);
ok(
  'low confidence → held',
  decide(baseClassification({ confidence: 0.4 }), safeBody).action === 'hold',
);
ok(
  'needs_human → held',
  decide(baseClassification({ needs_human: true, needs_human_reason: 'x' }), safeBody).action === 'hold',
);
ok(
  'high urgency → held',
  decide(baseClassification({ urgency: 'high' }), safeBody).action === 'hold',
);
ok(
  'non-human sender → ignored',
  decide(baseClassification({ is_from_a_human: false }), safeBody).action === 'ignore',
);

// The body scan is the last line of defence: a routine-looking email whose
// draft happens to quote a price must never go out unreviewed.
for (const risky of [
  'Sure — that will be $2,000 up front.',
  'I can guarantee delivery by the 14th.',
  'I will send the invoice tomorrow.',
  'Happy to sign the NDA.',
  "That's 500,000 naira for the full scope.",
]) {
  ok(
    `body scan catches: "${risky.slice(0, 42)}…"`,
    decide(baseClassification(), risky).action === 'hold',
  );
}

/* ------------------------------------------------------------------ */

section('Email parsing');
ok(
  'parses "Name <email>"',
  parseAddress('"Ada Obi" <Ada@Studio.CO>').email === 'ada@studio.co',
);
ok('parses a bare address', parseAddress('ada@studio.co').email === 'ada@studio.co');
ok(
  'strips quoted reply history',
  trimQuotedReply('Yes, Friday works.\n\nOn Mon, Chima wrote:\n> original text') ===
    'Yes, Friday works.',
);
ok(
  'decodes a base64url plain-text part',
  extractBody({
    mimeType: 'text/plain',
    body: { data: Buffer.from('hello there').toString('base64url') },
  }) === 'hello there',
);
ok(
  'falls back to stripping HTML',
  extractBody({
    mimeType: 'text/html',
    body: { data: Buffer.from('<p>hello <b>there</b></p>').toString('base64url') },
  }) === 'hello there',
);

/* ------------------------------------------------------------------ */

console.log('');
if (failures) {
  console.log(`\x1b[31m${failures} of ${checks} checks failed.\x1b[0m\n`);
  process.exit(1);
}
console.log(`\x1b[32mAll ${checks} checks passed.\x1b[0m\n`);
