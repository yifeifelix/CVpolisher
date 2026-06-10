/**
 * Mock mail transport for Phase 1. Two cooperating outputs:
 *
 * 1. `process.stdout` — a machine-readable block per message, format
 *    pinned by ADR-0004 §3:
 *
 *      [MOCK MAIL] to: <recipient>
 *      [MOCK MAIL] subject: <subject>
 *      [MOCK MAIL] link: <link>          (omitted if no link)
 *      [MOCK MAIL] body: <body with \n-escaped newlines>
 *      [MOCK MAIL] END
 *
 *    A developer reading the terminal grabs the verification link
 *    from here during manual testing.
 *
 * 2. An in-memory ring buffer, capped at 50 entries, readable via
 *    `getRecentMail`. The `/api/dev/outbox` route (see ADR-0004 §3
 *    "Layer B") serves this to E2E test drivers.
 *
 * Both outputs are synchronous and side-effect-only. There is no
 * persistence; the buffer is lost at process exit. Real delivery
 * (Resend, SES, etc.) is a Phase 4 swap-in.
 */

export interface SendMailInput {
  to: string;
  subject: string;
  body: string;
  link?: string;
}

export interface OutboxRecord {
  to: string;
  subject: string;
  body: string;
  link?: string;
  sentAt: Date;
}

const BUFFER_CAPACITY = 50;
// Oldest → newest. `push` appends; on overflow we drop from the front.
const outbox: OutboxRecord[] = [];

export function sendMail(input: SendMailInput): void {
  const record: OutboxRecord = {
    to: input.to,
    subject: input.subject,
    body: input.body,
    link: input.link,
    sentAt: new Date(),
  };

  writeStdoutBlock(record);

  outbox.push(record);
  while (outbox.length > BUFFER_CAPACITY) {
    outbox.shift();
  }
}

export function getRecentMail(limit = BUFFER_CAPACITY): OutboxRecord[] {
  // Newest first so consumers (UI, E2E driver) get the "last email"
  // semantics without reversing themselves.
  const slice = outbox.slice(-limit);
  return slice.reverse();
}

/**
 * Test-only reset. Underscore-prefixed to make it obviously
 * non-public. Never call from production code paths.
 */
export function _resetOutboxForTest(): void {
  outbox.length = 0;
}

function writeStdoutBlock(record: OutboxRecord): void {
  const lines: string[] = [];
  lines.push(`[MOCK MAIL] to: ${record.to}`);
  lines.push(`[MOCK MAIL] subject: ${record.subject}`);
  if (record.link !== undefined) {
    lines.push(`[MOCK MAIL] link: ${record.link}`);
  }
  lines.push(`[MOCK MAIL] body: ${escapeForBlock(record.body)}`);
  lines.push("[MOCK MAIL] END");
  process.stdout.write(lines.join("\n") + "\n");
}

function escapeForBlock(s: string): string {
  // Collapse literal newlines so the '[MOCK MAIL] END' terminator
  // is never ambiguous in downstream log parsers. Also escape the
  // backslash so "\n" in input survives a round-trip unambiguously.
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}
