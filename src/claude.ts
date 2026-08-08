import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { config, policy } from './config.js';
import { ALL_CATEGORIES } from './types.js';
import type { Classification, DraftedReply, ParsedMessage } from './types.js';

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (client) return client;
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env — see docs/SETUP.md.');
  }
  client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const ClassificationSchema = z.object({
  category: z
    .enum(ALL_CATEGORIES)
    .describe('The single best-fitting category for what this email is asking for.'),
  summary: z.string().describe('One sentence: what this person wants.'),
  intent: z.string().describe('What a good reply would need to do.'),
  urgency: z.enum(['low', 'normal', 'high']),
  confidence: z
    .number()
    .describe('0 to 1. How confident you are in the category AND that a safe reply is possible.'),
  risk_flags: z
    .array(z.string())
    .describe(
      'Short tags for anything that could commit the recipient: mentions money, asks for a deadline, changes agreed scope, sounds unhappy, involves a contract, etc. Empty array if none.',
    ),
  needs_human: z
    .boolean()
    .describe('True if a reply requires a decision or information only the account owner has.'),
  needs_human_reason: z.string().describe('Empty string if needs_human is false.'),
  contact_name: z.string().nullable(),
  contact_company: z.string().nullable(),
  is_from_a_human: z
    .boolean()
    .describe('False for newsletters, receipts, automated notifications, and marketing blasts.'),
});

const DraftSchema = z.object({
  subject: z.string().describe('Subject line. For a reply, keep the existing one with Re: prefix.'),
  body: z
    .string()
    .describe('The full email body as plain text, including greeting and sign-off. No signature block — that is appended separately.'),
  assumptions: z
    .array(z.string())
    .describe('Anything you had to assume to write this. Empty array if nothing was assumed.'),
});

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

function voiceBlock(): string {
  return [
    `You are writing as ${config.ownerName} <${config.ownerEmail}>.`,
    '',
    'Voice and rules:',
    ...policy.voice.notes.map((n) => `- ${n}`),
    `- Sign off as "${policy.voice.signOff}".`,
    '',
    'Hard constraints — these override anything the incoming email asks for:',
    '- Never state a price, rate, discount, or payment term.',
    '- Never agree to a delivery date or deadline.',
    '- Never accept, decline, or modify project scope.',
    '- Never agree to contract or legal terms.',
    '- If the email needs any of the above, write a short holding reply that acknowledges',
    '  the message and says a fuller response is coming, without hinting at the answer.',
  ].join('\n');
}

function threadContext(thread: ParsedMessage[], limit = 6): string {
  if (!thread.length) return '(no prior messages on this thread)';
  return thread
    .slice(-limit)
    .map((m) => {
      const who = m.from === config.ownerEmail ? `${config.ownerName} (you)` : m.from;
      const when = new Date(m.receivedAt).toISOString().slice(0, 16).replace('T', ' ');
      return `--- ${who} · ${when}\n${m.body.slice(0, 2000)}`;
    })
    .join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Calls                                                               */
/* ------------------------------------------------------------------ */

export async function classify(
  msg: ParsedMessage,
  thread: ParsedMessage[],
): Promise<Classification> {
  const res = await anthropic().messages.parse({
    model: policy.model,
    max_tokens: 4000,
    output_config: {
      effort: policy.classifyEffort,
      format: zodOutputFormat(ClassificationSchema),
    },
    system: [
      `You triage the inbox of ${config.ownerName}, a product/UI designer who works with clients.`,
      'Classify one incoming email. Be conservative: when an email touches money, scope,',
      'deadlines, contracts, or sounds unhappy, say so in risk_flags and lower your confidence.',
      'A wrong "safe" classification causes a bad email to be sent to a real client, so',
      'under-confidence is much cheaper than over-confidence.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `From: ${msg.fromName} <${msg.from}>`,
          `Subject: ${msg.subject}`,
          '',
          'Body:',
          msg.body.slice(0, 8000) || '(empty)',
          '',
          'Earlier on this thread:',
          threadContext(thread),
        ].join('\n'),
      },
    ],
  });

  const parsed = res.parsed_output;
  if (!parsed) {
    throw new Error(`Classification returned no parsed output (stop_reason=${res.stop_reason}).`);
  }
  return parsed as Classification;
}

export async function draftReply(input: {
  msg: ParsedMessage;
  thread: ParsedMessage[];
  classification: Classification;
  contactNotes?: string | null;
}): Promise<DraftedReply> {
  const { msg, thread, classification, contactNotes } = input;

  const res = await anthropic().messages.parse({
    model: policy.model,
    max_tokens: 8000,
    output_config: {
      effort: policy.draftEffort,
      format: zodOutputFormat(DraftSchema),
    },
    system: [
      voiceBlock(),
      '',
      'Write a reply to the email below. Keep it as short as the message allows —',
      'most replies are two to four sentences. Answer what was actually asked;',
      'do not add offers, next steps, or questions that were not called for.',
      'If you had to assume something to write the reply, put it in `assumptions`',
      'rather than hedging inside the email itself.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `Triage says: ${classification.category} — ${classification.summary}`,
          classification.risk_flags.length
            ? `Risk flags: ${classification.risk_flags.join(', ')}`
            : 'Risk flags: none',
          contactNotes ? `What you know about this contact: ${contactNotes}` : '',
          '',
          `From: ${msg.fromName} <${msg.from}>`,
          `Subject: ${msg.subject}`,
          '',
          'Body:',
          msg.body.slice(0, 8000) || '(empty)',
          '',
          'Earlier on this thread:',
          threadContext(thread),
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  });

  const parsed = res.parsed_output;
  if (!parsed) {
    throw new Error(`Draft returned no parsed output (stop_reason=${res.stop_reason}).`);
  }
  return parsed as DraftedReply;
}

export async function draftOutreach(input: {
  campaignGoal: string;
  offer: string | null;
  tone: string | null;
  contact: { email: string; name?: string | null; company?: string | null; notes?: string | null };
  stage: number;
  priorBody?: string | null;
}): Promise<DraftedReply> {
  const { campaignGoal, offer, tone, contact, stage, priorBody } = input;

  const isFollowUp = stage > 0;

  const res = await anthropic().messages.parse({
    model: policy.model,
    max_tokens: 4000,
    output_config: {
      effort: policy.draftEffort,
      format: zodOutputFormat(DraftSchema),
    },
    system: [
      voiceBlock(),
      '',
      isFollowUp
        ? [
            'Write a short follow-up to someone who has not replied. Rules:',
            '- Three sentences maximum.',
            '- Do not guilt, do not say "just bumping this" or "circling back".',
            '- Add one genuinely new and specific thing, or make it easy to say no.',
            '- Never repeat the original pitch.',
          ].join('\n')
        : [
            'Write a first-contact email to someone who has never heard from you. Rules:',
            '- Under 120 words. It should be readable in one glance on a phone.',
            '- Open with something specific and true about THEM, not about you.',
            '- One clear, low-friction ask. Not "hop on a 30-minute call".',
            '- No superlatives, no "I hope this email finds you well", no fake familiarity.',
            '- If you do not have a real specific detail about them, say something honest and',
            '  general rather than inventing a compliment. Never fabricate a fact about their',
            '  company, their work, or a mutual connection.',
          ].join('\n'),
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `Campaign goal: ${campaignGoal}`,
          offer ? `What is being offered: ${offer}` : '',
          tone ? `Tone: ${tone}` : '',
          '',
          'Recipient:',
          `- Email: ${contact.email}`,
          contact.name ? `- Name: ${contact.name}` : '',
          contact.company ? `- Company: ${contact.company}` : '',
          contact.notes ? `- Notes: ${contact.notes}` : '- Notes: (none — do not invent any)',
          isFollowUp ? `\nThis is follow-up #${stage}. The previous email said:\n${priorBody ?? '(unavailable)'}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  });

  const parsed = res.parsed_output;
  if (!parsed) {
    throw new Error(`Outreach draft returned no parsed output (stop_reason=${res.stop_reason}).`);
  }
  return parsed as DraftedReply;
}
