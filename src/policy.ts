import { config, policy } from './config.js';
import { ROUTINE_CATEGORIES } from './types.js';
import type { Classification, Decision, ParsedMessage } from './types.js';

/** Emails we never reply to at all: bounces, newsletters, calendar bots. */
export function shouldIgnore(msg: ParsedMessage): { ignore: boolean; reason: string } {
  if (msg.from === config.ownerEmail) {
    return { ignore: true, reason: 'Sent by you.' };
  }
  for (const label of policy.ignore.gmailLabelsToSkip) {
    if (msg.labelIds.includes(label)) {
      return { ignore: true, reason: `Gmail label ${label}.` };
    }
  }
  for (const pattern of policy.ignore.fromPatterns) {
    if (new RegExp(pattern, 'i').test(msg.from)) {
      return { ignore: true, reason: `Sender matches ignore pattern /${pattern}/.` };
    }
  }
  for (const pattern of policy.ignore.subjectPatterns) {
    if (new RegExp(pattern, 'i').test(msg.subject)) {
      return { ignore: true, reason: `Subject matches ignore pattern /${pattern}/.` };
    }
  }
  return { ignore: false, reason: '' };
}

/**
 * The core autonomy call: given a classification, does this reply go out on its
 * own or wait for a human?
 *
 * Deliberately biased toward holding. Every rule here has one job: make sure a
 * mistake costs a few minutes of review rather than a client relationship.
 */
export function decide(classification: Classification, draftBody: string): Decision {
  if (policy.autonomy === 'draft_all') {
    return { action: 'hold', reason: 'Policy autonomy is draft_all — everything is reviewed.' };
  }

  if (!classification.is_from_a_human) {
    return { action: 'ignore', reason: 'Classified as automated / non-human mail.' };
  }

  if (policy.autonomy === 'auto_all') {
    return { action: 'auto_send', reason: 'Policy autonomy is auto_all.' };
  }

  // --- auto_routine, the default ---

  if (classification.needs_human) {
    return {
      action: 'hold',
      reason: classification.needs_human_reason || 'Needs a decision only you can make.',
    };
  }

  if (!policy.autoSend.categories.includes(classification.category)) {
    return {
      action: 'hold',
      reason: `Category "${classification.category}" is not on the auto-send list.`,
    };
  }

  // Belt and braces: the category list should already exclude these, but a
  // mislabelled sensitive email is exactly the failure we can least afford.
  if (!ROUTINE_CATEGORIES.includes(classification.category as never)) {
    return { action: 'hold', reason: `Category "${classification.category}" is not routine.` };
  }

  if (classification.risk_flags.length > 0) {
    return { action: 'hold', reason: `Risk flags: ${classification.risk_flags.join(', ')}.` };
  }

  if (classification.confidence < policy.autoSend.minConfidence) {
    return {
      action: 'hold',
      reason: `Confidence ${classification.confidence.toFixed(2)} is below the ${policy.autoSend.minConfidence} threshold.`,
    };
  }

  // Last line of defence — scan the text we are about to send, not just the
  // model's opinion of it. If the draft itself mentions money or a date, hold.
  for (const pattern of policy.autoSend.blockIfBodyMatches) {
    const re = new RegExp(pattern, 'i');
    if (re.test(draftBody)) {
      return {
        action: 'hold',
        reason: `Draft text matched the blocked pattern /${pattern}/.`,
      };
    }
  }

  if (classification.urgency === 'high') {
    return { action: 'hold', reason: 'Marked high urgency — worth your eyes.' };
  }

  return {
    action: 'auto_send',
    reason: `Routine "${classification.category}", confidence ${classification.confidence.toFixed(2)}, no risk flags.`,
  };
}
