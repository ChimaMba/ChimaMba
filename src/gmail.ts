import fs from 'node:fs';
import { google, gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { config, GMAIL_SCOPES } from './config.js';
import type { ParsedMessage } from './types.js';

export function makeOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );
}

export function authUrl(client: OAuth2Client): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    // Forces a refresh_token even if you've authorised this client before.
    prompt: 'consent',
  });
}

export function saveTokens(tokens: unknown): void {
  fs.writeFileSync(config.tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function hasTokens(): boolean {
  return fs.existsSync(config.tokenPath);
}

let cached: gmail_v1.Gmail | null = null;

export function gmailClient(): gmail_v1.Gmail {
  if (cached) return cached;
  if (!hasTokens()) {
    throw new Error(
      `No Gmail token at ${config.tokenPath}. Run \`npm run auth\` once to connect your account.`,
    );
  }
  const auth = makeOAuthClient();
  auth.setCredentials(JSON.parse(fs.readFileSync(config.tokenPath, 'utf8')));
  // The refresh token is long-lived; persist rotations so we never fall out of auth.
  auth.on('tokens', (t) => {
    const existing = JSON.parse(fs.readFileSync(config.tokenPath, 'utf8'));
    saveTokens({ ...existing, ...t });
  });
  cached = google.gmail({ version: 'v1', auth });
  return cached;
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

export function parseAddress(raw: string): { email: string; name: string } {
  const match = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (match) {
    return { name: (match[1] ?? '').trim(), email: (match[2] ?? '').trim().toLowerCase() };
  }
  return { name: '', email: raw.trim().toLowerCase() };
}

function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Walks the MIME tree and returns the best-effort plain-text body. */
export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  const plain: string[] = [];
  const html: string[] = [];

  const walk = (part: gmail_v1.Schema$MessagePart): void => {
    const mime = part.mimeType ?? '';
    const data = part.body?.data;
    if (data && mime === 'text/plain') plain.push(decodeB64Url(data));
    else if (data && mime === 'text/html') html.push(decodeB64Url(data));
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);

  const raw = plain.length ? plain.join('\n') : stripHtml(html.join('\n'));
  return trimQuotedReply(raw);
}

/**
 * Cuts the quoted history off the bottom of a reply. Keeping it would blow up
 * token cost on long threads and confuse the classifier — we pass explicit
 * thread history separately instead.
 */
export function trimQuotedReply(body: string): string {
  const markers = [
    /^On .+ wrote:$/m,
    /^-{2,}\s*Original Message\s*-{2,}/im,
    /^_{10,}$/m,
    /^From:\s.+$/m,
    /^Sent from my /m,
  ];
  let cut = body.length;
  for (const re of markers) {
    const m = body.match(re);
    if (m?.index !== undefined && m.index < cut) cut = m.index;
  }
  return body
    .slice(0, cut)
    .replace(/^>.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function toParsedMessage(msg: gmail_v1.Schema$Message): ParsedMessage {
  const headers = msg.payload?.headers;
  const from = parseAddress(headerValue(headers, 'From'));
  const to = parseAddress(headerValue(headers, 'To'));
  const dateHeader = headerValue(headers, 'Date');
  const receivedAt = msg.internalDate
    ? Number(msg.internalDate)
    : dateHeader
      ? Date.parse(dateHeader)
      : Date.now();

  return {
    gmailMessageId: msg.id ?? '',
    gmailThreadId: msg.threadId ?? '',
    from: from.email,
    fromName: from.name,
    to: to.email,
    subject: headerValue(headers, 'Subject'),
    body: extractBody(msg.payload ?? undefined),
    snippet: msg.snippet ?? '',
    receivedAt: Number.isFinite(receivedAt) ? receivedAt : Date.now(),
    labelIds: msg.labelIds ?? [],
  };
}

/** Unread messages in the inbox, newest first. */
export async function fetchUnread(maxResults = 25): Promise<ParsedMessage[]> {
  const gmail = gmailClient();
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox -category:promotions -category:social',
    maxResults,
  });
  const ids = (list.data.messages ?? []).map((m) => m.id).filter((x): x is string => Boolean(x));

  const out: ParsedMessage[] = [];
  for (const id of ids) {
    const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    out.push(toParsedMessage(full.data));
  }
  return out;
}

/** Prior messages on a thread, oldest first, for reply context. */
export async function fetchThread(threadId: string): Promise<ParsedMessage[]> {
  const gmail = gmailClient();
  const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
  return (res.data.messages ?? [])
    .map(toParsedMessage)
    .sort((a, b) => a.receivedAt - b.receivedAt);
}

export async function markRead(messageId: string): Promise<void> {
  await gmailClient().users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
}

export async function ensureLabel(name: string): Promise<string> {
  const gmail = gmailClient();
  const res = await gmail.users.labels.list({ userId: 'me' });
  const existing = res.data.labels?.find((l) => l.name === name);
  if (existing?.id) return existing.id;
  const created = await gmail.users.labels.create({
    userId: 'me',
    requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
  });
  return created.data.id ?? '';
}

export async function addLabel(messageId: string, labelId: string): Promise<void> {
  await gmailClient().users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds: [labelId] },
  });
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

function encodeHeader(value: string): string {
  // RFC 2047 for non-ASCII subjects/names.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export interface SendOptions {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  /** RFC822 Message-ID of the message being replied to. */
  inReplyTo?: string | null;
  /** Adds List-Unsubscribe headers. Required for bulk/cold mail. */
  unsubscribeUrl?: string | null;
}

export async function sendEmail(opts: SendOptions): Promise<{ id: string; threadId: string }> {
  const gmail = gmailClient();

  const lines = [
    `From: ${encodeHeader(config.ownerName)} <${config.ownerEmail}>`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ];

  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`);
  }
  if (opts.unsubscribeUrl) {
    lines.push(
      `List-Unsubscribe: <${opts.unsubscribeUrl}>, <mailto:${config.ownerEmail}?subject=unsubscribe>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    );
  }

  const raw = `${lines.join('\r\n')}\r\n\r\n${Buffer.from(opts.body, 'utf8').toString('base64')}`;
  const encoded = Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded, ...(opts.threadId ? { threadId: opts.threadId } : {}) },
  });

  return { id: res.data.id ?? '', threadId: res.data.threadId ?? '' };
}

/** The RFC822 Message-ID header, needed to thread a reply correctly. */
export async function getRfc822MessageId(messageId: string): Promise<string | null> {
  const res = await gmailClient().users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['Message-ID'],
  });
  const v = headerValue(res.data.payload?.headers, 'Message-ID');
  return v || null;
}
