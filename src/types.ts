export type DraftKind = 'reply' | 'outreach' | 'followup';

export type DraftStatus =
  | 'pending' // waiting for you in the review queue
  | 'sent'
  | 'rejected'
  | 'failed';

/**
 * Categories the classifier assigns to an inbound email. The split between
 * "routine" and "sensitive" is what the autonomy policy keys off — see
 * config/policy.json. Anything that can commit you to money, scope, or a date
 * lives on the sensitive side and is held for review by default.
 */
export const ROUTINE_CATEGORIES = [
  'scheduling',
  'acknowledgment',
  'faq',
  'logistics',
  'thanks',
  'intro_response',
] as const;

export const SENSITIVE_CATEGORIES = [
  'pricing',
  'scope_change',
  'contract_or_legal',
  'complaint',
  'deadline_commitment',
  'refund_or_billing',
  'sensitive_personal',
  'other',
] as const;

export const ALL_CATEGORIES = [...ROUTINE_CATEGORIES, ...SENSITIVE_CATEGORIES] as const;

export type Category = (typeof ALL_CATEGORIES)[number];

export interface Classification {
  category: Category;
  summary: string;
  intent: string;
  urgency: 'low' | 'normal' | 'high';
  confidence: number;
  risk_flags: string[];
  needs_human: boolean;
  needs_human_reason: string;
  contact_name: string | null;
  contact_company: string | null;
  is_from_a_human: boolean;
}

export interface DraftedReply {
  subject: string;
  body: string;
  assumptions: string[];
}

export interface ParsedMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  receivedAt: number;
  labelIds: string[];
}

export interface Decision {
  action: 'auto_send' | 'hold' | 'ignore';
  reason: string;
}
