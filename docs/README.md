# Inbox Agent

An email agent for client work. It reads your Gmail, decides what each message
is, writes the reply, sends the safe ones on its own, and holds anything that
could commit you to money, scope, or a date. It also runs outreach campaigns to
prospects with the throttling and opt-out machinery that keeps a Gmail account
from getting flagged.

Built to be self-hosted. Your mail, your API key, your machine.

> New here? Go to **[SETUP.md](SETUP.md)** — it walks through Google Cloud, the
> API key, and first run in about fifteen minutes.

---

## What it actually does

**Every couple of minutes** it checks for unread mail and, for each message:

1. **Filters** out bounces, newsletters, calendar bots, and anything on your
   suppression list — before spending a token.
2. **Classifies** it with Claude: what is this, what does it want, how confident
   are we, and does it touch anything risky.
3. **Drafts** a reply in your voice, with hard instructions never to state a
   price, agree to a deadline, or accept scope.
4. **Decides**: send it, or hold it for you.
5. **Sends or queues** accordingly. Held drafts land in a dashboard where you
   read, edit, and send with one click.

Separately, it works through outreach campaigns: drafts a first-contact email
per prospect, waits for your approval on the first touch, then sends follow-ups
on a schedule — and stops the whole sequence the moment someone replies.

## The autonomy question

This is the setting that matters. It lives in `config/policy.json`:

| `autonomy`     | What happens                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| `auto_routine` | **Default.** Scheduling, acknowledgments, logistics, and FAQs go out on their own. Anything about price, scope, deadlines, contracts, or a complaint waits for you. |
| `draft_all`    | Nothing sends without you. The agent only writes.                             |
| `auto_all`     | Everything sends. No review. Read the warning below before choosing this.     |

Under `auto_routine`, a reply only sends automatically if **all** of these hold:

- The category is on the `autoSend.categories` list
- The classifier's confidence is at or above `minConfidence` (default 0.82)
- Zero risk flags were raised
- The classifier didn't mark it as needing a human
- Urgency isn't `high`
- **The drafted text itself** contains no money, date, contract, or guarantee
  language — this is a regex scan of what's about to be sent, not a re-ask of
  the model's opinion
- You're outside quiet hours and under the daily cap

Any one of those failing means it waits for you. The bias is deliberate: a
false hold costs you thirty seconds, a false send costs you a client.

**On `auto_all`:** the model can be wrong about what an email is, and there is
no undo on a sent email. Use it only after you've watched the review queue for
a few weeks and agree with the calls it was making.

## Outreach and the law

Cold email to people who never contacted you is regulated. The app implements
the mechanical requirements and leaves the judgment to you:

- **A working unsubscribe** in every outreach email, plus `List-Unsubscribe`
  and one-click `List-Unsubscribe-Post` headers so Gmail and Outlook show a
  native unsubscribe button.
- **Your physical postal address** in the footer. CAN-SPAM requires this;
  campaigns refuse to send until `POSTAL_ADDRESS` is set.
- **Suppression that actually holds.** Unsubscribes, plus anyone who replies
  "stop" / "remove me" / "unsubscribe" in plain English, go on a list that every
  send path checks. Re-importing them into a campaign silently skips them.
- **Throttling** — a daily cap, a minimum gap between sends, randomised jitter,
  and a 90-day block on cold-emailing the same address twice. This is what keeps
  a personal Gmail account from being rate-limited or flagged as a spam source.
- **Stop-on-reply** — a reply kills every queued follow-up for that person
  immediately.

What the app can't decide for you: whether you have a lawful basis to contact
someone at all. Under GDPR/PECR that's a real question with real answers, and
it depends on who you're emailing and where they live. Sending fewer, better
targeted emails is both the legally safer and the commercially better move.

## Commands

```bash
npm install
npm run auth      # one-time: connect your Gmail account
npm run check     # offline self-check — run this after editing policy.json
npm run dev       # start the agent + dashboard
npm run build     # compile to dist/
npm start         # run the compiled build
```

## Layout

```
config/policy.json   Autonomy, voice, throttles, ignore rules — edit this
src/
  claude.ts          Classification and drafting (Claude Opus 5, structured outputs)
  policy.ts          The send/hold decision. The most important file here.
  compliance.ts      Unsubscribe tokens, footers, rate limits, quiet hours
  gmail.ts           OAuth, MIME parsing, sending
  inbound.ts         The inbound pipeline
  outreach.ts        Campaigns, sequencing, follow-ups
  worker.ts          The polling loop
  server.ts          Dashboard API + unsubscribe + OAuth callback
  scripts/check.ts   The self-check
web/                 Dashboard (plain HTML/CSS/JS, no build step)
data/                SQLite database + Gmail token. Gitignored. Back this up.
```

## Cost

Two Claude calls per inbound email — one cheap classification at `low` effort,
one draft at `high`. On a normal freelance inbox that lands well under a dollar
a day. Both effort levels are configurable in `config/policy.json`; dropping
`draftEffort` to `medium` roughly halves it.

## Security

- `data/` holds your Gmail refresh token and every email the agent has read.
  It is gitignored. Don't commit it, and back it up somewhere encrypted.
- Set `DASHBOARD_PASSWORD` before exposing the port anywhere but localhost. The
  dashboard can send email as you.
- The app never sends to an address you haven't seen or imported, never emails
  itself, and honours the suppression list on every path.
